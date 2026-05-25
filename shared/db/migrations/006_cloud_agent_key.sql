-- Migration 006: cloud agent credentials on-prem

INSERT OR IGNORE INTO setting (key, value) VALUES ('cloud_agent_key', '');
