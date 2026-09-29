import urllib.request
import urllib.parse
import json
import ssl
import http.cookiejar

BASE_URL = "https://blue-monkey-950817.hostingersite.com"
ctx = ssl.create_default_context()

cookie_jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(cookie_jar),
    urllib.request.HTTPSHandler(context=ctx)
)

def test_full_portal():
    print("=== Complete Hospital Portal Live Verification ===\n")
    
    # 1. Login
    login_url = f"{BASE_URL}/api/auth/login"
    login_payload = json.dumps({
        "email": "demo@hospital.com",
        "password": "demopassword123"
    }).encode("utf-8")
    
    req = urllib.request.Request(
        login_url,
        data=login_payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "HospitalWA-Verifier/1.0"
        },
        method="POST"
    )
    
    try:
        with opener.open(req) as res:
            print(f"[PASS] Authentication (/api/auth/login): HTTP {res.status}")
    except Exception as e:
        print(f"[FAIL] /api/auth/login: {e}")

    # 2. Test All Hospital Admin Portal Pages
    portal_routes = [
        ("/dashboard", "Executive Clinical Dashboard"),
        ("/appointments", "Appointments & Slot Management"),
        ("/contacts", "Patient CRM & Contact Directory"),
        ("/inbox", "Live WhatsApp Shared Inbox & Multi-Agent Chat"),
        ("/automations", "Workflow Automations & Trigger Rules"),
        ("/broadcasts", "WhatsApp Broadcast Campaigns"),
        ("/calendar", "Doctor OPD Calendar Integration"),
        ("/templates", "Meta WhatsApp Message Templates"),
        ("/reports", "Clinical & Operational Analytics Reports"),
        ("/settings", "Hospital Configuration & Doctor Profile"),
        ("/demo", "Interactive WhatsApp AI Patient Simulator")
    ]

    print("\n--- Testing All Portal Routes (Authenticated) ---")
    all_ok = True
    for route, name in portal_routes:
        url = f"{BASE_URL}{route}"
        req_page = urllib.request.Request(
            url,
            headers={"User-Agent": "HospitalWA-Verifier/1.0"},
            method="GET"
        )
        try:
            with opener.open(req_page) as res:
                body = res.read().decode("utf-8")
                is_200 = res.status == 200
                has_html = len(body) > 500
                passed = is_200 and has_html
                if not passed:
                    all_ok = False
                print(f"[{'PASS' if passed else 'FAIL'}] {name} ({route}): HTTP {res.status} ({len(body)} bytes)")
        except Exception as e:
            all_ok = False
            print(f"[FAIL] {name} ({route}): {e}")

    print(f"\nPortal verification summary: {'ALL PASSED' if all_ok else 'SOME FAILED'}")

if __name__ == "__main__":
    test_full_portal()
