from playwright.sync_api import sync_playwright

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

        # Navigate to the app
        print("Navigating to http://localhost:9090...")
        try:
            page.goto("http://localhost:9090", timeout=10000)

            # Wait for the trace hierarchy to load in Sidebar
            print("Waiting for sidebar items...")
            # Use a more flexible selector or specific item
            page.wait_for_selector('text=Command Buffer 0', timeout=10000)

            # Take Overview screenshot
            print("Taking overview screenshot...")
            page.screenshot(path="verification/overview.png")

            # Switch to Timeline
            print("Switching to Timeline...")
            page.click('text="Timeline"')

            # Wait for Timeline canvas elements (tracks)
            page.wait_for_selector('text=Compute Encoders', timeout=5000)
            page.wait_for_timeout(500)
            page.screenshot(path="verification/timeline.png")

            # Switch to Resources
            print("Switching to Resources...")
            page.click('text="Resources"')

            # Wait for Resource graph elements
            page.wait_for_selector('text=Peak Memory', timeout=5000)
            page.wait_for_timeout(500)
            page.screenshot(path="verification/resources.png")

            print("Verification complete.")
        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/error_final.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_frontend()
