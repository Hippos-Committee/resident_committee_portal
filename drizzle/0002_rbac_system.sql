-- RBAC System Migration
-- Creates permissions, roles, and role_permissions tables

-- Permissions table
CREATE TABLE IF NOT EXISTS "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL UNIQUE,
	"description" text,
	"category" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Roles table
CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL UNIQUE,
	"description" text,
	"color" text DEFAULT 'bg-gray-500' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Role-Permission junction table
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
	"permission_id" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add role_id column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role_id" uuid REFERENCES "roles"("id");

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_role_permissions_role_id" ON "role_permissions"("role_id");
CREATE INDEX IF NOT EXISTS "idx_role_permissions_permission_id" ON "role_permissions"("permission_id");
CREATE INDEX IF NOT EXISTS "idx_users_role_id" ON "users"("role_id");
