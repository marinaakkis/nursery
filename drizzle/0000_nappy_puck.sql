CREATE TYPE "public"."user_role" AS ENUM('customer', 'agronomist', 'warehouse');--> statement-breakpoint
CREATE TYPE "public"."care_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."care_type" AS ENUM('watering', 'feeding', 'pruning');--> statement-breakpoint
CREATE TYPE "public"."light_level" AS ENUM('sun', 'partial', 'shade');--> statement-breakpoint
CREATE TYPE "public"."planting_season" AS ENUM('spring', 'autumn', 'spring_autumn');--> statement-breakpoint
CREATE TYPE "public"."demand_kind" AS ENUM('sold', 'rejected_no_stock');--> statement-breakpoint
CREATE TYPE "public"."fulfillment" AS ENUM('pickup', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'assembling', 'ready_for_pickup', 'handed_to_delivery', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('new', 'in_progress', 'answered');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"plant_id" integer NOT NULL,
	"type" "care_type" NOT NULL,
	"period_days" integer NOT NULL,
	"season_only" boolean DEFAULT false NOT NULL,
	CONSTRAINT "care_rules_plant_type_uq" UNIQUE("plant_id","type"),
	CONSTRAINT "care_rules_period_ck" CHECK ("care_rules"."period_days" > 0)
);
--> statement-breakpoint
CREATE TABLE "plants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ru" text NOT NULL,
	"name_lat" text NOT NULL,
	"description" text NOT NULL,
	"light" "light_level" NOT NULL,
	"min_zone" smallint NOT NULL,
	"planting_season" "planting_season" NOT NULL,
	"care_level" "care_level" NOT NULL,
	"soil" text NOT NULL,
	"price_cents" integer NOT NULL,
	"photo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "plants_min_zone_ck" CHECK ("plants"."min_zone" between 2 and 6),
	CONSTRAINT "plants_price_ck" CHECK ("plants"."price_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"plant_id" integer NOT NULL,
	"received_at" date NOT NULL,
	"quantity" integer NOT NULL,
	"remaining" integer NOT NULL,
	"supplier" text NOT NULL,
	CONSTRAINT "batches_remaining_nonneg_ck" CHECK ("batches"."remaining" >= 0),
	CONSTRAINT "batches_remaining_max_ck" CHECK ("batches"."remaining" <= "batches"."quantity")
);
--> statement-breakpoint
CREATE TABLE "demand_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"plant_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"kind" "demand_kind" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demand_facts_quantity_ck" CHECK ("demand_facts"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "write_offs" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text NOT NULL,
	"actor_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "write_offs_quantity_ck" CHECK ("write_offs"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"plant_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "cart_items_customer_plant_uq" UNIQUE("customer_id","plant_id"),
	CONSTRAINT "cart_items_quantity_ck" CHECK ("cart_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "delivery_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"slot_date" date NOT NULL,
	"interval" text NOT NULL,
	"capacity" integer DEFAULT 5 NOT NULL,
	"taken" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "delivery_slots_date_interval_uq" UNIQUE("slot_date","interval"),
	CONSTRAINT "delivery_slots_capacity_ck" CHECK ("delivery_slots"."taken" <= "delivery_slots"."capacity"),
	CONSTRAINT "delivery_slots_taken_nonneg_ck" CHECK ("delivery_slots"."taken" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"plant_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"price_cents" integer NOT NULL,
	CONSTRAINT "order_items_quantity_ck" CHECK ("order_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"batch_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "order_reservations_order_batch_uq" UNIQUE("order_id","batch_id"),
	CONSTRAINT "order_reservations_quantity_ck" CHECK ("order_reservations"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"actor_role" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"status" "order_status" DEFAULT 'new' NOT NULL,
	"fulfillment" "fulfillment" NOT NULL,
	"slot_id" integer,
	"total_cents" integer NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_idempotency_uq" UNIQUE("idempotency_key"),
	CONSTRAINT "orders_delivery_slot_ck" CHECK (("orders"."fulfillment" = 'delivery') = ("orders"."slot_id" is not null)),
	CONSTRAINT "orders_total_ck" CHECK ("orders"."total_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "care_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"garden_plant_id" integer NOT NULL,
	"type" "care_type" NOT NULL,
	"planned_on" date NOT NULL,
	"is_done" boolean DEFAULT false NOT NULL,
	"done_on" date,
	CONSTRAINT "care_events_plant_type_date_uq" UNIQUE("garden_plant_id","type","planned_on"),
	CONSTRAINT "care_events_done_ck" CHECK ("care_events"."is_done" = ("care_events"."done_on" is not null))
);
--> statement-breakpoint
CREATE TABLE "garden_plants" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"plant_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"acquired_at" date NOT NULL,
	CONSTRAINT "garden_plants_customer_plant_uq" UNIQUE("customer_id","plant_id"),
	CONSTRAINT "garden_plants_quantity_ck" CHECK ("garden_plants"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "answer_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"body" text NOT NULL,
	"rationale" text NOT NULL,
	"confidence" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" integer
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"author_role" "user_role" NOT NULL,
	"body" text NOT NULL,
	"photo_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"plant_id" integer,
	"status" "question_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_rules" ADD CONSTRAINT "care_rules_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_facts" ADD CONSTRAINT "demand_facts_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "write_offs" ADD CONSTRAINT "write_offs_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "write_offs" ADD CONSTRAINT "write_offs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_reservations" ADD CONSTRAINT "order_reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_reservations" ADD CONSTRAINT "order_reservations_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_slot_id_delivery_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."delivery_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_events" ADD CONSTRAINT "care_events_garden_plant_id_garden_plants_id_fk" FOREIGN KEY ("garden_plant_id") REFERENCES "public"."garden_plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_plants" ADD CONSTRAINT "garden_plants_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_plants" ADD CONSTRAINT "garden_plants_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_drafts" ADD CONSTRAINT "answer_drafts_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_drafts" ADD CONSTRAINT "answer_drafts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "batches_oldest_idx" ON "batches" USING btree ("plant_id","received_at","id");