#!/usr/bin/env python3
"""
Simple HTTP server for testing the 3D well visualization
"""
import http.server
import socketserver
import os
import webbrowser
import threading
import time

def start_server(port=8000):
    """Start a simple HTTP server"""
    # Change to the agriculture directory
    os.chdir('d:\\Old Windows\\Desctop\\ProJect\\my.giot.ir\\agriculture')
    
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory='.', **kwargs)
        
        def log_message(self, format, *args):
            """Custom log format"""
            print(f"[{time.strftime('%H:%M:%S')}] {format % args}")
    
    with socketserver.TCPServer(("", port), Handler) as httpd:
        print(f"🌐 Server started at http://localhost:{port}")
        print(f"📁 Serving files from: {os.getcwd()}")
        print(f"🔗 Test URLs:")
        print(f"   - http://localhost:{port}/test-water-indicators.html")
        print(f"   - http://localhost:{port}/index.html")
        print(f"   - http://localhost:{port}/test-3d-well.html")
        print(f"\nPress Ctrl+C to stop the server")
        
        # Open browser automatically
        def open_browser():
            time.sleep(1)
            webbrowser.open(f'http://localhost:{port}/test-water-indicators.html')
        
        threading.Thread(target=open_browser, daemon=True).start()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped by user")
            httpd.shutdown()

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    start_server(port)