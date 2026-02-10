# Vault Curator - Day 1: Infrastructure

**Date:** 2026-02-07  
**Focus:** Setting up CouchDB, LiveSync, and vault client library

## CouchDB + LiveSync Setup

**Goal:** Enable direct programmatic access to Obsidian vault via CouchDB.

**Steps:**
1. Installed CouchDB 3.5.1 via snap
2. Created admin user and obsidian_user credentials
3. Created `obsidian` database with CORS enabled
4. Set up Cloudflare Tunnel: `obsidian.mossmanphotography.co.uk` → localhost:5984
5. Configured Obsidian LiveSync plugin (without E2EE for direct markdown access)

**Key Learning:** Disabling E2EE encryption is essential for direct programmatic access to note content. With encryption, you can only access encrypted blobs.

**Credentials:**
- CouchDB Admin: `admin` / `[REDACTED]`
- CouchDB User: `obsidian_user` / `[REDACTED]`
- Database: `obsidian`

## Vault Client Library

**Built:** Node.js library to interact with CouchDB in LiveSync format.

**Features:**
- `readNote(path)` - Read note with frontmatter
- `writeNote(path, content)` - Create/update notes
- `listNotes()` - List all vault notes
- `searchNotes(query)` - Full-text search
- `getStats()` - Vault statistics

**Technical Details:**
- LiveSync stores notes as metadata docs + content chunks
- Chunks are content-addressable (hash-based IDs: `h:xxxxx`)
- Path IDs are lowercase for case-insensitive filesystems
- Chunks are typically ~50KB each

**Test Success:** Created a test note that synced perfectly to MacBook vault.

## Model Testing & Strategy

**Tested local models:**
- **CodeLlama 7B:** Too slow (11+ min, no output) - REJECTED ❌
- **Qwen2.5-Coder 7B:** Usable (~3-4 min, clean code) - SELECTED ✅

**Strategy decided:**
- Use Sonnet (Anthropic API) for architecture and design
- Use Qwen2.5-Coder (local) for code generation to save costs
- Reserve Sonnet for complex tasks

---

*Part 2 of 6 - Vault Curator Build Documentation*

---

[[00-index|<- Back to Index]] | **Previous:** [[01-overview|<- Overview]] | **Next:** [[03-day2-building|Building ->]]
