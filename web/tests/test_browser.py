import pytest
from playwright.sync_api import Page, expect
import time

# To run this test, ensure the app is running locally (e.g. on http://127.0.0.1:5000)
# Command: pytest tests/test_browser.py

BASE_URL = "http://127.0.0.1:5000"

def test_home_page_language_and_tabs(page: Page):
    # Load the page
    page.goto(BASE_URL)
    
    # Check title
    expect(page).to_have_title("Regarder les VOD Kick et Twitch sans abonnement | KickNoSub")
    
    # 1. Change Language to English
    # Open lang dropdown
    page.click('#lang-btn')
    page.click('a[data-lang="en"]')
    # Wait for translation to apply
    time.sleep(1)
    
    # Verify a text changed
    expect(page.locator('#watch-now-btn span')).to_have_text("Watch Now")
    
    # 2. Check Trending Tabs
    # Click Twitch trending tab
    page.click('button[data-tab="twitch-trending"]')
    # The Kick grid should be hidden, Twitch grid should be visible
    expect(page.locator('#trending-twitch-grid')).to_be_visible()
    
    # Click Kick trending tab
    page.click('button[data-tab="kick-trending"]')
    expect(page.locator('#trending-grid')).to_be_visible()

    # 3. Check Mobile Menu
    # Set viewport to mobile size
    page.set_viewport_size({"width": 375, "height": 812})
    # Wait for layout shift
    time.sleep(0.5)
    
    # Open mobile menu
    page.click('#mobile-menu-btn')
    # Menu should be visible
    expect(page.locator('.nav-links')).to_be_visible()
    
    # 4. Confirm no unwanted redirects (check URL is still same)
    assert page.url == f"{BASE_URL}/"

    print("Browser E2E test passed perfectly!")
