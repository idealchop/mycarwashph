#!/usr/bin/env python3
"""Runs the real sign-in flow against the local emulators and captures the key screens.

Prereqs (see README): `pnpm emulators`, `pnpm seed:emulator`, and the web app on :3000.
    CHROME_PATH=/usr/bin/google-chrome python3 scripts/screenshots.py [base_url] [out_dir]
"""
import json
import os
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
OUT = sys.argv[2] if len(sys.argv) > 2 else "docs/screenshots"
PROJECT = os.environ.get("FIREBASE_PROJECT", "demo-mycarwash")
AUTH_EMU = os.environ.get("AUTH_EMULATOR", "http://127.0.0.1:9099")
SEED = json.load(open("/tmp/mycarwash-seed.json"))
PHONE = {"width": 390, "height": 844}


def latest_code(phone):
    """The Auth emulator exposes sent SMS codes; no real SMS is sent."""
    for _ in range(20):
        with urllib.request.urlopen(f"{AUTH_EMU}/emulator/v1/projects/{PROJECT}/verificationCodes") as r:
            codes = [c for c in json.load(r)["verificationCodes"] if c["phoneNumber"] == phone]
        if codes:
            return codes[-1]["code"]
        time.sleep(0.5)
    raise RuntimeError("no verification code found")


def shot(page, name, full=False):
    page.wait_for_timeout(600)
    page.screenshot(path=f"{OUT}/{name}.png", full_page=full)
    print("saved", f"{OUT}/{name}.png")


def sign_in(page, national, e164, capture=False):
    page.goto(BASE + "/")
    page.get_by_text("Continue with phone number").wait_for()
    if capture:
        shot(page, "01-welcome")
    page.get_by_text("Continue with phone number").click()
    page.wait_for_url("**/sign-in/phone")
    page.locator("input[name=phone]").fill(national)
    if capture:
        page.locator("input[name=phone]").blur()
        shot(page, "02-phone-number")
    page.get_by_role("button", name="Send code").click()
    page.wait_for_url("**/sign-in/code")
    code = latest_code(e164)
    boxes = page.locator("input[inputmode=numeric]")
    boxes.first.click()
    page.keyboard.type(code[:3])
    if capture:
        shot(page, "03-code")
    page.keyboard.type(code[3:])
    page.wait_for_url("**/home")


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH"), args=["--no-sandbox"])

    # Partner owner: welcome -> phone -> code -> Partner home -> Scan verified.
    ctx = browser.new_context(viewport=PHONE, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    sign_in(page, "9171234567", "+639171234567", capture=True)
    page.get_by_role("button", name="Accept").first.wait_for()
    shot(page, "04-partner-home")
    page.goto(BASE + "/scan")
    page.get_by_label("Or type the code").fill(SEED["bookings"][1]["checkIn"]["qrPayload"])
    page.get_by_role("button", name="Verify booking").click()
    page.get_by_text("Booking verified").wait_for()
    shot(page, "05-scan-verified")
    ctx.close()

    # Paid owner: phone home, then the desktop dashboard.
    ctx = browser.new_context(viewport=PHONE, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    sign_in(page, "9181234567", "+639181234567")
    page.get_by_text("Bay 1").first.wait_for()
    shot(page, "06-paid-home")
    ctx.close()

    ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    page = ctx.new_page()
    sign_in(page, "9181234567", "+639181234567")
    page.get_by_text("here’s today").wait_for()
    shot(page, "07-desktop-dashboard", full=True)
    ctx.close()
    browser.close()
