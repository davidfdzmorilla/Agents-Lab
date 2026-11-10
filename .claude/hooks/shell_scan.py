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
Redirect) exits with status 4. A write redirection whose target is computed when the command
runs, or holds a barrier piece around a variable (see Dynamic), exits with status 5. A script of
sh -c that is not one quoted string or one plain word (see Glued) exits with status 6.
bash-guard.sh blocks the command on any non-zero status, so the scanner never fails open.
Output is written once, at the end, so a failure never leaves a partial view behind.
"""
import posixpath, re, sys

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
SHELLS = {"sh", "bash", "zsh", "dash", "ksh", "csh", "tcsh"}
# An option cluster that includes -c (-c, -lc, -ce, -xec ...). zsh also takes digits (-1c, -c1).
C_FLAG = re.compile(r"-[a-zA-Z0-9]*c[a-zA-Z0-9]*")
# An option cluster of a shell. Each o or O in it takes the next word (-o posix, +O extglob,
# -co posix, -oo a b), and so do ksh's T and R (-cT 1, -c -T 0, -R file). zsh also reads -oNAME:
# counting every one only takes words that could be the script as option arguments, and those
# stay scanned (see Line.end_word).
OPT_ARG = re.compile(r"[-+][A-Za-z0-9]+")
# An option word that is written out: letters and digits, or a long option (--norc, --rcfile=f).
# Anything else in it (-[c], -?, -c(N), -c#, -<->c, -$x) is expanded when the command runs.
LIT_OPT = re.compile(r"[-+][A-Za-z0-9]*|--(?:[A-Za-z0-9][A-Za-z0-9-]*(?:=.*)?)?")
# A redirection word (> f, >>f, 2>/dev/null, &>f, >&2, <in, <<<): it and its file are not arguments.
REDIR = re.compile(r"[0-9]*(?:&>>?|<<<|<>|<&|>&|>>|>\||>!|<|>)")
DQ_STR = re.compile(r'"((?:[^"\\]|\\.)*)"', re.S)
# Pieces of a barrier path (TD-061). The literal part of a write target built around a variable
# must not hold one. Compared in lower case, because APFS ignores case.
BARRIER = (".claude/hooks", ".githooks", "settings", ".git/",
           # note 2: the suffixes and names of the barrier files, and task-scope.json
           "hooks/", "bash-guard", "shell_scan", "lib.sh", "pre-commit", "task-scope",
           "scope-guard", "role-guard", "commit-msg")
# The simple variables of a write target: $NAME, $1, $@, $$ ... (VAR) and ${NAME}, ${10} (BRACED).
VAR = re.compile(r"[A-Za-z_][A-Za-z0-9_]*|[0-9]|[@*#?$!-]")
BRACED = re.compile(r"[A-Za-z_][A-Za-z0-9_]*|[0-9]+|[@*#?$!-]")
# A descriptor after >& (>&2, >& 1, >&-): not a file.
FD = re.compile(r"(?:[0-9]+|-)(?=[ \t\r\n;&|()<>]|$)")
# Brace expansion outside quotes: {a,b}, {1..3}.
BRACES = re.compile(r"\{([^{}]*)\}")


class Redirect(Exception):
    """A "(" after a write redirection (> (x), >>(x), 2>(x)): zsh reads the target as a glob, so
    the file it writes cannot be checked. A lone ">" glued to "(" after a blank is a process
    substitution, whose body is scanned as code, and does not raise."""


class Dynamic(Exception):
    """A write redirection whose target is computed when the command runs ($(...), `...`, {a,b}),
    or whose literal part around a variable holds a piece of a barrier path ($X/.claude/hooks/x):
    the file it writes cannot be checked (TD-061). A variable alone (> "$LOG") is allowed."""


class Glued(Exception):
    """The script of sh -c is not one quoted string or one plain word: a part glued after the
    closing quote (bash -c "echo x > ".claude/hooks/x), an empty string before it (bash -c ""'...'),
    or quotes or backslashes inside an unquoted word (bash -c echo' x > y', bash -c cat\\ .e\\\\nv),
    also in a word with braces that can expand to the -c and its script (bash {-c,"echo x > y"}).
    The outer shell joins the parts and the inner shell reads them again as code, so the parts
    the scan would read as plain words of the outer command are not checked."""


class Ambiguous(Exception):
    """A "#" right after "(" or ")", or at a comment position inside "( )": bash reads a comment,
    while zsh, in a pattern ([[ a == (#) ]], [[ a == ( # ) ]], case ... in (#)), reads text. Either
    reading can hide the rest of the line from the rules, so the command is not evaluated."""


def neutral(text, keep_dollar):
    return "".join("_" if c in NEUTRAL or (c == "$" and not keep_dollar) else c for c in text)


def barrier(text):
    # True if text, read as a path in lower case (APFS ignores case), holds a piece of BARRIER.
    # A $(...) or `...` can stand for several components, so a ".." after it may climb past
    # its prefix (.git/$(printf "refs\057heads")/../../config): the prefix is checked too.
    head = re.split(r"\$\(|`", text, maxsplit=1)[0]
    paths = [posixpath.normpath("/" + text.lower())]
    if head != text:
        paths.append(posixpath.normpath("/" + head.lower()) + "/")
    return any(b in p for p in paths for b in BARRIER)


def ansi_c(text):
    def rep(m):
        g = m.group(1)
        if g[0] in "xuU" and len(g) > 1:
            return chr(int(g[1:], 16))
        if g[0] in "01234567":
            return chr(int(g, 8))
        return SIMPLE.get(g, g)
    return ESC.sub(rep, text)


# Note 1 of TD-061: assignments in the command (X=..., X+=..., export X=..., for X in ...) whose
# value holds a barrier piece. The value of X=... is one word with its quoted parts (WORD); the
# words of for X in ... run to the next ; & | or newline (WORDS). Quotes and backslashes are
# dropped. The text is read without quote state, so this can only add names; a write target
# with one of them is blocked.
ASSIGN = re.compile(r"(?<![^\s;&|(){}`])(?:([A-Za-z_][A-Za-z0-9_]*)\+?=|for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s)")
WORD = re.compile(r"""(?:"[^"]*"|'[^']*'|\$\([^()]*\)|`[^`]*`|\\.|[^\s;&|"'\\]){0,4096}""")
WORDS = re.compile(r"[^;&|\n]{0,4096}")


def taint(src):
    src = src.replace("\\\n", "")
    names = set()
    for m in ASSIGN.finditer(src):
        value = (WORD if m.group(1) else WORDS).match(src, m.end()).group()
        if barrier(value.replace('"', "").replace("'", "").replace("\\", "")):
            names.add(m.group(1) or m.group(2))
    return names


class Line:
    """Words of the current output line, fed as the output grows. The checks that look at the
    line (heredoc consumer, sh -c) read this state instead of joining the whole output again.
    The scan is still not linear in every case (an unclosed "$( rebuilds it, and so do
    heredocs): bash-guard.sh caps the size and onFailure blocks a timeout."""

    def __init__(self):
        self.reset()

    def reset(self):
        self.buf, self.first, self.shell, self.c_run, self.arg, self.target = [], "", False, False, 0, False
        self.dyn_c = False

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
        if self.shell and (self.target or REDIR.match(w)):
            # A redirection and its file are not arguments: bash -c >/tmp/o '...' and bash -c 2>
            # /dev/null '...' still run the script, so they keep c_run.
            self.target = not self.target and REDIR.fullmatch(w) is not None
            return
        # A word of a shell line is computed when the command runs if it holds $ (a variable, or
        # the mark that Scan.mark leaves for $( ), `...`, an unquoted glob, a leading ~ or a zsh
        # "( )"), an unquoted { other than a literal {} (find -exec bash {} \;), or, in an option
        # word, anything but letters and digits (see LIT_OPT). It can be or hold a -c cluster
        # (-e${x}c, -{e,c}, $(echo -c), -$(echo c), -[c], ~n with hash -d n=-c), so it counts as
        # one and the next string is scanned as code.
        dyn = self.shell and ("$" in w or ("{" in w and w != "{}") or (w[0] in "-+" and not LIT_OPT.fullmatch(w)))
        # dyn_c: a computed word can also hold the options that take the next words (-co, -oc,
        # -{c,o}, ~ with HOME=-co), and how many is not known. From it on, no plain word of the
        # line turns c_run off: bash $(echo -co) posix '...' and bash -co$(:) posix '...'.
        self.dyn_c = self.dyn_c or dyn
        if w.startswith(("-", "+")):
            # c_run: the options after the last plain word include a -c cluster. +x is an option.
            # An option word is never taken as an argument: zsh -O -c runs the script.
            self.c_run = self.c_run or dyn or C_FLAG.fullmatch(w) is not None
            if self.shell and OPT_ARG.fullmatch(w):
                self.arg += w.count("o") + w.count("O") + w.count("T") + w.count("R")
        elif self.arg:
            # The argument of -o, -O, +o or +O (bash -c -o posix "..."): the script is still to come.
            # A computed one can hold the -c too (bash -o $x "..." with x="posix -c").
            self.arg -= 1
            self.c_run = self.c_run or dyn
        elif not (("$" in w or self.dyn_c) and self.shell and self.c_run):  # $E can expand to nothing
            self.c_run = dyn
            # =bash and BASH are bash too (zsh's "=" expansion; APFS ignores case), and so is {bash:
            # zsh runs {bash -c '...'} with the brace glued.
            self.shell = self.shell or w.lstrip("{").rsplit("/", 1)[-1].lstrip("=").lower() in SHELLS


def outer_unescape(body, esc):
    # The text that the shell reading "..." or an unquoted heredoc hands on to the inner shell.
    # First \<newline> after an odd run of \ is removed (the lines are joined), so a $ or ` on
    # the next line is not read as escaped (\\\<newline>$X). Then \\ is \ and \c is c for c in
    # esc. A $ or ` after an even run of \ is expanded by the outer shell: no \ is left in front
    # of it, or the scan would read as escaped what runs (\\$X, \\${X}, .e\\`echo n`v).
    # (?<!\\) starts each match at the beginning of a run: without it, a long run of \ that no
    # newline follows is retried from every \ in it (quadratic).
    body = re.sub(r"(?<!\\)(\\+)\n", lambda m: m.group(1)[:-1] if len(m.group(1)) % 2 else m.group(0), body)
    def run(m):
        k, c = len(m.group(1)) // 2, m.group(2)
        if len(m.group(1)) % 2:
            return "\\" * k + c if c and c in esc else "\\" * (k + 1) + c
        return "\\" * (k - k % 2 if c in ("$", "`") and c else k) + c
    return re.sub(r"(\\+)(.?)", run, body, flags=re.S)


class Scan:
    def __init__(self, src, tainted=None):
        self.s, self.i, self.out = src, 0, []
        self.pending, self.pipe, self.drop = [], 0, []
        self.ln, self.fed, self.dq_open = Line(), 0, set()
        # Note 1 of TD-061: names assigned a barrier path in the command; sub-scans share them.
        self.tainted = taint(src) if tainted is None else tainted

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
        s, depth, groups = self.s, 0, []
        while self.i < len(s):
            c, n = s[self.i], s[self.i + 1:self.i + 2]
            if close == "`" and c == "`":
                self.i += 1
                return True
            if close == ")" and c == ")" and depth == 0:
                self.i += 1
                return True
            if c == "\\":
                ln = self.line()
                if ln.shell and (ln.c_run or "{" in ln.buf) and n != "\n":
                    raise Glued()  # a backslash in an unquoted -c word: bash -c cat\\ .e\\\\nv, bash {-c,echo\\ x}
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
                state = self.opt_state(0)
                self.emit("$_\n"); self.top(")"); self.emit("\n")
                self.resume(state, True)
            elif c == "`":
                self.i += 1
                state = self.opt_state(0)
                self.emit("$_\n"); self.top("`"); self.emit("\n")
                self.resume(state, True)
            elif c in "()":
                ln = self.line()
                mark = c == "(" and bool(ln.first or ln.partial())
                if mark:
                    self.redirect_paren()
                # A "(" after a word of a shell line (a zsh glob group or qualifier, -c(N), or <( ),
                # >( ), =( )) is computed too: the line state comes back at its ")", marked.
                group = self.opt_state(0) if mark else None
                if c == "(":
                    groups.append(group)
                elif groups:
                    group = groups.pop()
                depth += 1 if c == "(" else (-1 if depth else 0)
                self.i += 1
                self.emit("$_\n" if mark else "\n")
                if c == ")":
                    self.resume(group, True)
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
            elif c == ">":
                self.write_target()
                self.i += 1
                self.emit(c)
            else:
                if c in "*?[^" or (c == "~" and (self.i == 0 or s[self.i - 1] in WORD_END)):
                    self.mark()  # a glob or a leading ~ (~n, ~+, ~-, ~ with HOME=-c) can be -c
                self.i += 1
                self.emit(c)
        return False

    def mark(self):
        # The word in progress on a shell line is computed when the command runs: a "$" in its
        # line state (not in the output) makes it count as one (see Line.end_word).
        ln = self.line()
        if ln.shell:
            ln.buf.append("$")

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

    def write_target(self):
        # Called on a ">" outside quotes (TD-061). Reads the word after the redirection operator
        # (>, >>, >|, >!, >&, &>, N>, <>) and raises Dynamic if the file it names is computed when
        # the command runs, or if its literal part holds a barrier piece around a variable. A
        # descriptor (>&2, >&-), a process substitution and a "( )" (see Redirect) are not read.
        s, j = self.s, self.i + 1
        if s[j:j + 1] == ">":
            return  # the first ">" of ">>": the second one reads the target
        dup = s[j:j + 1] == "&"
        if s[j:j + 1] in ("|", "!", "&"):
            j += 1
        # Blanks and backslash-newline before the word (see redirect_paren).
        while j < len(s) and (s[j] in " \t" or s.startswith("\\\n", j)):
            j += 2 if s[j] == "\\" else 1
        if dup and FD.match(s, j):
            return
        word = self.word_at(j)
        if word is None:
            return
        lit, unq, names = word
        if any("," in m.group(1) or ".." in m.group(1) for m in BRACES.finditer(unq)):
            raise Dynamic()  # {a,b}: brace expansion
        if names and barrier(lit):
            raise Dynamic()
        if self.tainted.intersection(names):
            raise Dynamic()  # note 1: X=.claude/hooks/x; echo x > "$X"

    def word_at(self, j):
        # The shell word that starts at j, as (literal text, text outside quotes, variable names).
        # A quoted or escaped character is literal, and "_" in the text outside quotes; a
        # variable adds its name and no text. None if a quote or ${ is not closed: then the
        # shell runs nothing.
        s, lit, unq, names = self.s, [], [], []
        while j < len(s) and s[j] not in WORD_END and s[j] not in "<>":
            c, n = s[j], s[j + 1:j + 2]
            if c == "\\":
                if n != "\n":
                    lit.append(n)
                    unq.append("_")
                j += 2
            elif c == "'":
                k = s.find("'", j + 1)
                if k < 0:
                    return None
                lit.append(s[j + 1:k])
                unq.append("_")
                j = k + 1
            elif c == "$" and n == "'":
                # $'...' is decoded, as sanitize does: its text is literal.
                k = j + 2
                while k < len(s) and s[k] != "'":
                    k += 2 if s[k] == "\\" else 1
                if k >= len(s):
                    return None
                lit.append(ansi_c(s[j + 2:k]))
                unq.append("_")
                j = k + 1
            elif c == '"' or (c == "$" and n == '"'):
                j += 1 if c == '"' else 2
                while j < len(s) and s[j] != '"':
                    if s[j] == "\\" and s[j + 1:j + 2] in ("$", "`", '"', "\\", "\n"):
                        lit.append("" if s[j + 1] == "\n" else s[j + 1])
                        j += 2
                    elif s[j] in "$`":
                        j = self.expansion(j, lit, names)
                        if j < 0:
                            return None
                    else:
                        lit.append(s[j])
                        j += 1
                if j >= len(s):
                    return None
                unq.append("_")
                j += 1
            elif c in "$`":
                j = self.expansion(j, lit, names)
                if j < 0:
                    return None
            else:
                if c in "*?[":
                    raise Dynamic()  # note 4: a glob, which zsh expands in a redirection (MULTIOS)
                lit.append(c)
                unq.append(c)
                j += 1
        if s[j:j + 1] == "(" and (names or "".join(lit) not in ("", "=")):
            raise Dynamic()  # zsh glob group in the middle of the target: .claude/hook(s)/x
        return "".join(lit), "".join(unq), names

    def expansion(self, j, lit, names):
        # The expansion at s[j] ("$" or "`") inside a write target; returns where it ends, or -1
        # if a ${ is not closed. `...`, $(...), $((...)) and $[...] are computed when the
        # command runs. $NAME, $1, $@ ... and ${...} add a name; a lone "$" is literal.
        s, n = self.s, self.s[j + 1:j + 2]
        if s[j] == "`" or n in ("(", "["):
            raise Dynamic()
        m = VAR.match(s, j + 1)
        if m:
            if re.match(r":[A-Za-z&]", s[m.end():m.end() + 2]):
                raise Dynamic()  # zsh modifier: $X:h, $X:s/a/b/
            names.append(m.group())
            return m.end()
        if n == "{":
            k = s.find("}", j + 2)
            if k < 0:
                return -1
            body = s[j + 2:k]
            if not BRACED.fullmatch(body):
                # note 3: ${X:-...}, ${X#...}, ${X/...}, ${(L)X}: not a simple variable
                raise Dynamic()
            names.append(body)
            return k + 1
        if n in ("=", "~", "^", "+"):
            raise Dynamic()  # note 3: zsh $=X, $~X (the value is a glob), $^X, $+X
        lit.append("$")
        return j + 1

    def opt_state(self, used):
        # A shell line that waits for an option argument (bash -c -o 'posix' "...", bash -o
        # $(printf posix) -c "..."): its state, with used arguments taken, or None. The output of
        # the argument ends the line; resume() puts the state back, so the -c and the script
        # after it are still read. A $(...) does not take one: the rest of its word does. The
        # word in progress is kept too (TD-111): -$(:)c, -c$(:) and -e"$(:)" are still options.
        # After a computed word (dyn_c) a string can be an option argument too, so the state is
        # kept: bash $(echo -co) 'posix' '...'.
        ln = self.line()
        if not (ln.shell and (ln.arg or not used or ln.dyn_c)):
            return None
        return ln.first, ln.shell, ln.c_run, max(ln.arg - used, 0), list(ln.buf), ln.target, ln.dyn_c

    def resume(self, state, computed=False):
        # computed: the state comes back after a $( ), `...` or "( )", whose output is part of the
        # word in progress, so the word is marked (see mark): bash $(echo -c) '...'.
        if state:
            ln = self.line()
            ln.first, ln.shell, ln.c_run, ln.arg, ln.buf, ln.target, ln.dyn_c = state
            if computed:
                ln.buf.append("$")

    def keep_empty_word(self, before, mark_o):
        # "" or '' as a whole word is still an argument (grep "" .env): leave a placeholder.
        after = self.s[self.i:self.i + 1]
        if not "".join(self.out[mark_o:]) and before in ("", " ", "\n") and (after == "" or after in WORD_END):
            self.emit("_")

    def shell_c_string(self):
        # The string after `sh -c`, `bash -lc`, `bash -ce`, `bash -c --` ... is code: scan it
        # instead of hiding it. Also for $'...', decoded first.
        ln = self.line()
        if ln.shell and "{" in ln.buf:
            raise Glued()  # a quote inside an unquoted word with braces: bash {-c,"echo x > y"}
        if not (ln.shell and ln.c_run) or ln.target:  # bash -c > "/tmp/o" '...': the file, not the script
            return False
        if ln.buf:
            raise Glued()  # a quote inside an unquoted -c word: bash -c echo' x > y'
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
            body = outer_unescape(m.group(1), '$`"\n')
        if j + 1 < len(s) and s[j + 1] not in WORD_END and s[j + 1] not in "<>":
            raise Glued()  # a part glued after the closing quote: bash -c "echo x > "$X
        sub = Scan(body, self.tainted | taint(body))
        sub.top()
        state = self.opt_state(1)  # an option argument in quotes: bash -c -o 'posix' "..."
        self.emit("\n" + "".join(sub.out) + "\n")
        self.i = j + 1
        self.resume(state)
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
                state = self.opt_state(0)  # bash -o "$(printf posix)" -c "...": see top()
                self.emit("$_\n" if text else "\n"); self.top(")"); self.emit("\n")
                self.resume(state, True)
            elif c == "`":
                self.i += 1
                state = self.opt_state(0)
                self.emit("$_\n" if text else "\n"); self.top("`"); self.emit("\n")
                self.resume(state, True)
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
                if not h["quoted"]:  # the shell that reads it gets \$ as $ (like "...")
                    body = outer_unescape(body, '$`\n')
                sub = Scan(body, self.tainted | taint(body))
                sub.top()
                self.emit("\n" + "".join(sub.out) + "\n")
            elif not h["quoted"]:  # expanded body: keep its command substitutions
                sub = Scan(body, self.tainted | taint(body))
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
    except Dynamic:
        return 5
    except Glued:
        return 6
    except Ambiguous:
        sys.stderr.write("ambiguous '#' after '(' or ')', or inside '( )'\n")
        return 3
    sys.stdout.write(out)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
