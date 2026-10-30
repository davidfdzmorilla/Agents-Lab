"""Shell command scanner for bash-guard.sh (TASK-044). Standard library only.

Run only as:  python3 -I .claude/hooks/shell_scan.py sanitize|code  < command

  sanitize  one command segment per line. Separators: ; & && || | ( ) { } $( ` and newline.
            Inside quotes, metacharacters become "_" and everything else is kept, so ".env"
            is still .env. $(...) and `...`, also inside double quotes, become segments and
            leave the word $_ in the segment that uses their output. Comments are dropped.
  code      the original command without the bodies of data heredocs (cat, tee, python3,
            python with no pipe after them) and without backslash-newline.

A "(" after a word ($(, <(, >(, =(, a glob group or qualifier, ${(L)x}) also ends its line with
the word $_, so the words after the "( )" are not taken for arguments of the command.

Any other argument exits with status 2. An exception exits with status 1. A "#" that bash and
zsh read differently (see Ambiguous) exits with status 3. A "(" after a write redirection (see
Redirect) exits with status 4. bash-guard.sh blocks the command on any non-zero status, so the
scanner never fails open. Output is written once, at the end, so a
failure never leaves a partial view behind.
"""
import re, sys

# Heredoc consumers whose body is stdin data, not shell code.
DATA = {"cat", "tee", "python3", "python"}
# Words that open a command position without being the command itself.
LEAD = {"{", "}", "!", "do", "done", "then", "else", "elif", "fi", "if", "while", "until", "time"}
# Inside quotes these characters are literal; they become "_" so no rule reads them as syntax.
NEUTRAL = set(" \t\r\n;&|<>(){}'\"`\\!#")
WORD_END = set(" \t\r\n;&|()")
# A "#" after one of these (or at the start) opens a comment that runs to the end of the line.
# Not after "(" or ")": see Ambiguous.
COMMENT_AFTER = set(" \t\n;&|<>")
PARENS = set("()")
ESC = re.compile(r"\\(x[0-9A-Fa-f]{1,2}|u[0-9A-Fa-f]{1,4}|U[0-9A-Fa-f]{1,8}|[0-7]{1,3}|.)", re.S)
SIMPLE = {"n": "\n", "t": "\t", "r": "\r", "a": "\a", "b": "\b", "e": "\x1b", "E": "\x1b", "f": "\f", "v": "\v"}
SHELLS = {"sh", "bash", "zsh", "dash", "ksh"}
# An option cluster that includes -c (-c, -lc, -ce, -xec ...).
C_FLAG = re.compile(r"-[a-zA-Z]*c[a-zA-Z]*")
DQ_STR = re.compile(r'"((?:[^"\\]|\\.)*)"', re.S)


class Redirect(Exception):
    """A "(" after a write redirection (> (x), >>(x), 2>(x)): zsh reads the target as a glob, so
    the file it writes cannot be checked. A lone ">" glued to "(" after a blank is a process
    substitution, whose body is scanned as code, and does not raise."""


class Ambiguous(Exception):
    """A "#" right after "(" or ")", or at a comment position inside "( )": bash reads a comment,
    while zsh, in a pattern ([[ a == (#) ]], [[ a == ( # ) ]], case ... in (#)), reads text. Either
    reading can hide the rest of the line from the rules, so the command is not evaluated."""


def neutral(text, keep_dollar):
    return "".join("_" if c in NEUTRAL or (c == "$" and not keep_dollar) else c for c in text)


def ansi_c(text):
    def rep(m):
        g = m.group(1)
        if g[0] in "xuU" and len(g) > 1:
            return chr(int(g[1:], 16))
        if g[0] in "01234567":
            return chr(int(g, 8))
        return SIMPLE.get(g, g)
    return ESC.sub(rep, text)


class Line:
    """Words of the current output line, fed as the output grows. The checks that look at the
    line (heredoc consumer, sh -c) read this state instead of joining the whole output again.
    The scan is still not linear in every case (an unclosed "$( rebuilds it, and so do
    heredocs): bash-guard.sh caps the size and onFailure blocks a timeout."""

    def __init__(self):
        self.reset()

    def reset(self):
        self.buf, self.first, self.shell, self.c_run = [], "", False, False

    def partial(self):
        return "".join(self.buf)

    def feed(self, text):
        for ch in text:
            if ch == "\n":
                self.reset()
            elif ch.isspace():
                self.end_word()
            else:
                self.buf.append(ch)

    def end_word(self):
        if not self.buf:
            return
        w, self.buf = "".join(self.buf), []
        if not self.first and w not in LEAD:
            self.first = w
        if w.startswith("-"):
            # c_run: the options after the last plain word include a -c cluster.
            self.c_run = self.c_run or C_FLAG.fullmatch(w) is not None
        else:
            self.c_run = False
            # =bash and BASH are bash too (zsh's "=" expansion; APFS ignores case).
            self.shell = self.shell or w.rsplit("/", 1)[-1].lstrip("=").lower() in SHELLS


class Scan:
    def __init__(self, src):
        self.s, self.i, self.out = src, 0, []
        self.pending, self.pipe, self.drop = [], 0, []
        self.ln, self.fed, self.dq_open = Line(), 0, set()

    def emit(self, t):
        if t:
            self.out.append(t)

    def prev(self):
        for t in reversed(self.out):
            if t:
                return t[-1]
        return ""

    def line(self):
        for t in self.out[self.fed:]:
            self.ln.feed(t)
        self.fed = len(self.out)
        return self.ln

    def first_word(self):
        ln = self.line()
        w = ln.first or ln.partial()
        return "" if w in LEAD else w.rsplit("/", 1)[-1]

    def top(self, close=None):
        s, depth = self.s, 0
        while self.i < len(s):
            c, n = s[self.i], s[self.i + 1:self.i + 2]
            if close == "`" and c == "`":
                self.i += 1
                return True
            if close == ")" and c == ")" and depth == 0:
                self.i += 1
                return True
            if c == "\\":
                self.i += 2
                if n not in ("\n", ""):
                    self.emit("_" if n in NEUTRAL or n == "$" else n)
            elif c == "'":
                self.single()
            elif c == '"' or (c == "$" and n == '"'):
                self.i += 1 if c == '"' else 2
                self.double_or_rewind()
            elif c == "$" and n == "'":
                if not self.shell_c_string():
                    self.i += 2
                    self.ansi()
            elif c == "$" and n == "(":
                self.i += 2
                self.emit("$_\n"); self.top(")"); self.emit("\n")
            elif c == "`":
                self.i += 1
                self.emit("$_\n"); self.top("`"); self.emit("\n")
            elif c in "()":
                ln = self.line()
                mark = c == "(" and bool(ln.first or ln.partial())
                if mark:
                    self.redirect_paren()
                depth += 1 if c == "(" else (-1 if depth else 0)
                self.i += 1
                self.emit("$_\n" if mark else "\n")
            elif c == "\n":
                self.i += 1
                self.emit("\n"); self.pipe += 1
                self.heredocs()
            elif c in " \t\r":
                self.i += 1
                self.emit(" ")
            elif c == ";":
                self.i += 1
                self.emit("\n"); self.pipe += 1
            elif c == "&":
                if n == "&":
                    self.i += 2
                    self.emit("\n"); self.pipe += 1
                elif self.prev() in ("<", ">") or n == ">":
                    self.i += 1
                    self.emit("&")
                else:
                    self.i += 1
                    self.emit("\n"); self.pipe += 1
            elif c == "|":
                if n == "|":
                    self.i += 2
                    self.emit("\n"); self.pipe += 1
                elif self.prev() == ">":
                    self.i += 1
                    self.emit("|")
                else:
                    self.i += 2 if n == "&" else 1
                    for h in self.pending:
                        if h["pipe"] == self.pipe:
                            h["piped"] = True
                    self.emit("\n")
            elif s.startswith("<<<", self.i):
                self.i += 3
                self.emit("<<<")
            elif s.startswith("<<", self.i):
                self.heredoc_op()
            elif c in "{}" and (self.i == 0 or s[self.i - 1] in WORD_END) and (self.i + 1 >= len(s) or s[self.i + 1] in WORD_END):
                self.i += 1
                self.emit("\n")
            elif c == "#" and (self.i == 0 or s[self.i - 1] in COMMENT_AFTER or s[self.i - 1] in PARENS):
                if depth or s[self.i - 1:self.i] in PARENS:
                    raise Ambiguous()
                j = s.find("\n", self.i)  # a comment runs to the end of the line
                self.i = len(s) if j < 0 else j
            else:
                self.i += 1
                self.emit(c)
        return False

    def redirect_paren(self):
        # Called on a "(" that follows a word. Looks back over blanks and redirection operators.
        s, k = self.s, self.i - 1
        gap = False
        # A backslash-newline is a line continuation: zsh removes it, so it counts as a blank.
        while k >= 0 and (s[k] in " \t" or (s[k] == "\n" and k > 0 and s[k - 1] == "\\")):
            k, gap = k - (2 if s[k] == "\n" else 1), True
        e = k
        while k >= 0 and s[k] in "<>&|!0123456789":
            k -= 1
        op = s[k + 1:e + 1]
        if ">" not in op:
            return
        if op == ">" and not gap and (k < 0 or s[k] in " \t;&|("):
            return
        raise Redirect()

    def keep_empty_word(self, before, mark_o):
        # "" or '' as a whole word is still an argument (grep "" .env): leave a placeholder.
        after = self.s[self.i:self.i + 1]
        if not "".join(self.out[mark_o:]) and before in ("", " ", "\n") and (after == "" or after in WORD_END):
            self.emit("_")

    def shell_c_string(self):
        # The string after `sh -c`, `bash -lc`, `bash -ce`, `bash -c --` ... is code: scan it
        # instead of hiding it. Also for $'...', decoded first.
        ln = self.line()
        if ln.buf or not (ln.shell and ln.c_run):
            return False
        s = self.s
        if s.startswith("$'", self.i):
            j = self.i + 2
            while j < len(s) and s[j] != "'":
                j += 2 if s[j] == "\\" else 1
            if j >= len(s):
                return False
            body = ansi_c(s[self.i + 2:j])
        elif s[self.i] == "'":
            j = s.find("'", self.i + 1)
            if j < 0:
                return False
            body = s[self.i + 1:j]
        else:
            m = DQ_STR.match(s, self.i)
            if not m:
                return False
            j = m.end() - 1
            body = re.sub(r'\\([$`"\\\n])', r"\1", m.group(1))
        sub = Scan(body)
        sub.top()
        self.emit("\n" + "".join(sub.out) + "\n")
        self.i = j + 1
        return True

    def single(self):
        if self.shell_c_string():
            return
        j = self.s.find("'", self.i + 1)
        if j < 0:  # unclosed: the rest is read as code
            self.i += 1
            self.emit("_")
            return
        before, mark_o = self.prev(), len(self.out)
        self.emit(neutral(self.s[self.i + 1:j], False))
        self.i = j + 1
        self.keep_empty_word(before, mark_o)

    def ansi(self):
        s, j = self.s, self.i
        while j < len(s) and s[j] != "'":
            j += 2 if s[j] == "\\" else 1
        if j >= len(s):
            self.emit("_")
            return
        before, mark_o = self.prev(), len(self.out)
        self.emit(neutral(ansi_c(s[self.i:j]), False))
        self.i = j + 1
        self.keep_empty_word(before, mark_o)

    def double_or_rewind(self):
        self.i -= 1
        if self.shell_c_string():
            return
        self.i += 1
        mark_i, mark_o, before = self.i, len(self.out), self.prev()
        # unclosed: the rest is read as code. A string already found unclosed is not scanned
        # again, or nested '"$(' would cost twice as much per level.
        if mark_i in self.dq_open or not self.double('"', True):
            self.dq_open.add(mark_i)
            del self.out[mark_o:]
            if self.fed > mark_o:  # the line state saw output that is gone: rebuild it
                self.ln, self.fed = Line(), 0
            self.i = mark_i
            self.emit("_")
            return
        self.keep_empty_word(before, mark_o)

    def double(self, closing, text):
        s = self.s
        while self.i < len(s):
            c, n = s[self.i], s[self.i + 1:self.i + 2]
            if closing and c == closing:
                self.i += 1
                return True
            if c == "\\":
                self.i += 2 if n in ("$", "`", '"', "\\", "\n") else 1
                if text and n != "\n":
                    self.emit("_")
            elif c == "$" and n == "(":
                self.i += 2
                self.emit("$_\n" if text else "\n"); self.top(")"); self.emit("\n")
            elif c == "`":
                self.i += 1
                self.emit("$_\n" if text else "\n"); self.top("`"); self.emit("\n")
            else:
                self.i += 1
                if text:
                    self.emit("_" if c in NEUTRAL else c)
        return closing is None

    def heredoc_op(self):
        s = self.s
        self.i += 2
        strip = s[self.i:self.i + 1] == "-"
        self.i += 1 if strip else 0
        while self.i < len(s) and s[self.i] in " \t":
            self.i += 1
        delim, quoted = "", False
        while self.i < len(s) and s[self.i] not in " \t\r\n;&|<>()":
            c = s[self.i]
            if c in "'\"":
                j = s.find(c, self.i + 1)
                if j < 0:
                    break
                delim += s[self.i + 1:j]
                quoted, self.i = True, j + 1
            elif c == "\\":
                delim += s[self.i + 1:self.i + 2]
                quoted, self.i = True, self.i + 2
            else:
                delim += c
                self.i += 1
        if delim:
            self.pending.append({"delim": delim, "strip": strip, "quoted": quoted,
                                 "consumer": self.first_word(), "pipe": self.pipe, "piped": False})
        self.emit(" ")

    def heredocs(self):
        pending, self.pending, s = self.pending, [], self.s
        for h in pending:
            start = pos = self.i
            body_end = end = None
            while True:
                nl = s.find("\n", pos)
                line = s[pos:] if nl < 0 else s[pos:nl]
                if (line.lstrip("\t") if h["strip"] else line) == h["delim"]:
                    body_end, end = pos, (len(s) if nl < 0 else nl + 1)
                    break
                if nl < 0:
                    break
                pos = nl + 1
            if end is None:  # no closing line: the rest is read as code
                return
            body = s[start:body_end]
            if h["consumer"] not in DATA or h["piped"]:
                sub = Scan(body)
                sub.top()
                self.emit("\n" + "".join(sub.out) + "\n")
            elif not h["quoted"]:  # expanded body: keep its command substitutions
                sub = Scan(body)
                sub.double(None, False)
                self.emit("\n" + "".join(sub.out) + "\n")
                if "$(" not in body and "`" not in body:
                    self.drop.append((start, end))
            else:
                self.drop.append((start, end))
            self.i = end


def sanitize(src):
    sc = Scan(src)
    sc.top()
    lines = []
    for ln in "".join(sc.out).split("\n"):
        words = ln.split()
        while words and words[0] in LEAD:
            words.pop(0)
        if words:
            lines.append(" ".join(words))
    return "\n".join(lines), sc


def code_view(src):
    sc = Scan(src)
    sc.top()
    keep, last = [], 0
    for a, b in sc.drop:
        keep.append(src[last:a])
        last = b
    keep.append(src[last:])
    return "".join(keep).replace("\\\n", "")


def main(argv):
    if len(argv) != 2 or argv[1] not in ("sanitize", "code"):
        sys.stderr.write("usage: python3 -I shell_scan.py sanitize|code < command\n")
        return 2
    src = sys.stdin.read()
    try:
        out = code_view(src) if argv[1] == "code" else sanitize(src)[0]
    except Redirect:
        return 4
    except Ambiguous:
        sys.stderr.write("ambiguous '#' after '(' or ')', or inside '( )'\n")
        return 3
    sys.stdout.write(out)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
