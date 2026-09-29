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

def test_login_flow():
    print("=== Testing Live Auth & Dashboard Flow ===")
    
    # 1. Login with demo credentials
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
            body = res.read().decode("utf-8")
            print(f"[PASS] /api/auth/login: HTTP {res.status}")
            print(f"       Response: {body[:150]}")
            print(f"       Cookies set: {[c.name for c in cookie_jar]}")
    except Exception as e:
        print(f"[FAIL] /api/auth/login error: {e}")

    # 2. Access protected dashboard with session cookies
    dash_url = f"{BASE_URL}/dashboard"
    req_dash = urllib.request.Request(
        dash_url,
        headers={"User-Agent": "HospitalWA-Verifier/1.0"},
        method="GET"
    )
    try:
        with opener.open(req_dash) as res:
            body = res.read().decode("utf-8")
            has_dash = "dashboard" in body.lower() or "hospital" in body.lower() or "appointments" in body.lower()
            print(f"[{'PASS' if res.status == 200 else 'FAIL'}] Authenticated /dashboard access: HTTP {res.status} (Length: {len(body)} bytes)")
    except Exception as e:
        print(f"[FAIL] /dashboard access error: {e}")

    # 3. Test appointments page
    app_url = f"{BASE_URL}/appointments"
    req_app = urllib.request.Request(
        app_url,
        headers={"User-Agent": "HospitalWA-Verifier/1.0"},
        method="GET"
    )
    try:
        with opener.open(req_app) as res:
            body = res.read().decode("utf-8")
            print(f"[{'PASS' if res.status == 200 else 'FAIL'}] Authenticated /appointments access: HTTP {res.status}")
    except Exception as e:
        print(f"[FAIL] /appointments access error: {e}")

    # 4. Test settings page
    set_url = f"{BASE_URL}/settings"
    req_set = urllib.request.Request(
        set_url,
        headers={"User-Agent": "HospitalWA-Verifier/1.0"},
        method="GET"
    )
    try:
        with opener.open(req_set) as res:
            body = res.read().decode("utf-8")
            print(f"[{'PASS' if res.status == 200 else 'FAIL'}] Authenticated /settings access: HTTP {res.status}")
    except Exception as e:
        print(f"[FAIL] /settings access error: {e}")

if __name__ == "__main__":
    test_login_flow()
