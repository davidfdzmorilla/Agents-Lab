CREATE TABLE "agent_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"system_prompt" text NOT NULL,
	"prompt_version" text NOT NULL,
	"provider_config_id" uuid NOT NULL,
	"model_id" text NOT NULL,
	"tool_allowlist" text[] DEFAULT '{}' NOT NULL,
	"max_calls" integer NOT NULL,
	"max_tokens" integer NOT NULL,
	"timeout_ms" integer NOT NULL,
	"output_schema" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "agent_definitions_role_check" CHECK ("agent_definitions"."role" in ('manager', 'researcher', 'analyst', 'writer', 'critic', 'evaluator'))
);
--> statement-breakpoint
CREATE TABLE "agent_invocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"run_id" uuid NOT NULL,
	"task_id" uuid,
	"agent_definition_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"provider_type" text NOT NULL,
	"model_id" text NOT NULL,
	"status" text NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"duration_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_reported" numeric,
	"validation" jsonb,
	"error" jsonb
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"budget_profile" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_id" uuid NOT NULL,
	"provider_type" text NOT NULL,
	"base_url" text,
	"default_model" text NOT NULL,
	"api_key_env" text
);
--> statement-breakpoint
CREATE TABLE "run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"run_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_events_run_id_seq_unique" UNIQUE("run_id","seq"),
	CONSTRAINT "run_events_type_check" CHECK ("run_events"."type" in ('run.started', 'run.step', 'agent.started', 'agent.completed', 'agent.failed', 'tool.started', 'tool.completed', 'run.awaiting_approval', 'run.resumed', 'run.cancelled', 'run.completed', 'run.partial', 'run.failed', 'budget.warning', 'budget.exceeded'))
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"request" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"budget" jsonb NOT NULL,
	"budget_used" jsonb,
	"result" jsonb,
	"error" jsonb,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"worker_id" text,
	"worker_heartbeat_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "runs_status_check" CHECK ("runs"."status" in ('queued', 'running', 'awaiting_approval', 'completed', 'partial', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"run_id" uuid NOT NULL,
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"assigned_role" text NOT NULL,
	"depends_on" uuid[] DEFAULT '{}' NOT NULL,
	"status" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	CONSTRAINT "tasks_assigned_role_check" CHECK ("tasks"."assigned_role" in ('manager', 'researcher', 'analyst', 'writer', 'critic', 'evaluator'))
);
--> statement-breakpoint
CREATE TABLE "team_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"graph_builder" text NOT NULL,
	"agent_ids" uuid[] NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_definitions" ADD CONSTRAINT "agent_definitions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_definitions" ADD CONSTRAINT "agent_definitions_provider_config_id_provider_configs_id_fk" FOREIGN KEY ("provider_config_id") REFERENCES "public"."provider_configs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_invocations" ADD CONSTRAINT "agent_invocations_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_invocations" ADD CONSTRAINT "agent_invocations_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_invocations" ADD CONSTRAINT "agent_invocations_agent_definition_id_agent_definitions_id_fk" FOREIGN KEY ("agent_definition_id") REFERENCES "public"."agent_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_configs" ADD CONSTRAINT "provider_configs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_team_id_team_definitions_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_definitions" ADD CONSTRAINT "team_definitions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_definitions_project_id_idx" ON "agent_definitions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "provider_configs_project_id_idx" ON "provider_configs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "runs_status_created_at_idx" ON "runs" USING btree ("status","created_at");