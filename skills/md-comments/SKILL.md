---
name: md-comments
description: "USE WHEN the user wants Claude to answer @claude review comments in a Markdown file, e.g. '/md-comments notes.md', 'resolve the comments in X.md', 'answer my md-read comments'. Edits the commented passages in place and resolves or replies to each thread. Works with md-read, which reloads the file live."
argument-hint: "[file.md]"
---

# md-comments

Answer the `@claude` review comments left in a Markdown file (usually from md-read).

## Comment format

Each comment wraps the blocks it is about, using HTML comments:

```md
<!-- @claude c1: merge these two paragraphs
claude: an earlier reply, if any
you: a follow-up from the author -->

…the commented blocks…

<!-- /@claude c1 -->
```

- The opening marker's first line is the request. Each later line is `name: text`, a reply in the thread.
- The latest line is what needs answering. If the latest line is already a `claude:` reply, the thread is waiting on the author: leave it alone.
- Never write `-->` inside a marker. It would close the comment early.

## Steps

1. **Find the file.** Use the path in the arguments. If none is given, find `.md` files under the
   current directory that contain `<!-- @claude`, most recently modified first, and ask which one
   if there is more than one.
2. **Read the whole file**, then list the open threads (id, request, the blocks they cover).
3. **For each open thread, in document order:**
   - If the request is clear, edit only the text between that thread's markers to do it, then
     **delete both markers** (the opening one with its replies and the `<!-- /@claude ID -->`
     line, plus the blank line after each).
   - If you need a decision from the author, leave the text alone and add one line
     `claude: <short question or reply>` just before the `-->` of the opening marker.
   - If the request asks for something outside its range (e.g. "update the intro to match"),
     do it, and say so in the summary.
4. **Do not touch anything else.** No reformatting, no reflowing paragraphs, no changing bullet
   style or table layout outside the marked ranges. md-read reloads the file on every save, so
   prefer a few precise edits over rewriting the whole file.
5. **Summarize** in chat: one line per thread with its id and what you did (resolved, or what you
   asked).
