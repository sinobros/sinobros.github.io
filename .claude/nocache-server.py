#!/usr/bin/env python3
"""Static file server for local preview only -- sends Cache-Control: no-store
on every response so the agent/browser always sees the current file content
while iterating. Not used in production (GitHub Pages serves the real
files with its own caching)."""
import http.server
import os
import sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        # Forces the browser to purge any stale cached responses for this
        # origin from earlier in this preview session (before this no-cache
        # server existed) instead of just preventing new staleness.
        self.send_header("Clear-Site-Data", '"cache"')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
directory = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(directory)
http.server.test(HandlerClass=NoCacheHandler, port=port, bind="127.0.0.1")
