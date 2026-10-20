-- Runs once, on an empty data volume (docker-entrypoint-initdb.d). Idempotent.
SELECT 'CREATE DATABASE agentlab' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'agentlab')\gexec
SELECT 'CREATE DATABASE agentlab_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'agentlab_test')\gexec
