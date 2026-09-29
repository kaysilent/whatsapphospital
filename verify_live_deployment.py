import urllib.request
import urllib.parse
import json
import ssl
import time
import sys

BASE_URL = "https://blue-monkey-950817.hostingersite.com"
ctx = ssl.create_default_context()

def test_url(path, method="GET", data=None, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = {"User-Agent": "HospitalWA-Verifier/1.0"}
    if headers:
        req_headers.update(headers)
    
    encoded_data = None
    if data:
        encoded_data = json.dumps(data).encode("utf-8")
        req_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=encoded_data, headers=req_headers, method=method)
    start_time = time.time()
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=20) as res:
            elapsed = (time.time() - start_time) * 1000
            content = res.read().decode("utf-8", errors="replace")
            return {
                "status": res.status,
                "headers": dict(res.headers),
                "body": content,
                "latency_ms": round(elapsed, 1),
                "error": None
            }
    except urllib.error.HTTPError as e:
        elapsed = (time.time() - start_time) * 1000
        body = e.read().decode("utf-8", errors="replace")
        return {
            "status": e.code,
            "headers": dict(e.headers),
            "body": body,
            "latency_ms": round(elapsed, 1),
            "error": str(e)
        }
    except Exception as e:
        elapsed = (time.time() - start_time) * 1000
        return {
            "status": 0,
            "headers": {},
            "body": "",
            "latency_ms": round(elapsed, 1),
            "error": str(e)
        }

def run_tests():
    results = {}
    print(f"=== Starting Live Verification against {BASE_URL} ===\n")
    
    # 1. Page Routes
    pages = [
        ("/", "Landing Page"),
        ("/login", "Authentication Login Page"),
        ("/demo", "WhatsApp AI Simulator / Demo"),
        ("/dashboard", "Admin Dashboard Analytics"),
        ("/appointments", "Appointments & Treatments"),
        ("/contacts", "Patient Contacts Directory"),
        ("/inbox", "Live WhatsApp Shared Inbox"),
        ("/automations", "Workflow Automations"),
        ("/broadcasts", "Broadcast Campaigns"),
        ("/settings", "Hospital Settings & Doctor Configuration")
    ]
    
    page_results = []
    print("--- 1. Testing Live Web Page Routes ---")
    for path, name in pages:
        res = test_url(path)
        status_ok = res["status"] == 200
        has_html = "<!DOCTYPE html" in res["body"] or "<html" in res["body"]
        passed = status_ok and has_html
        page_results.append({
            "path": path,
            "name": name,
            "status": res["status"],
            "latency_ms": res["latency_ms"],
            "passed": passed,
            "error": res["error"]
        })
        status_sym = "PASS" if passed else "FAIL"
        print(f"[{status_sym}] {name} ({path}): HTTP {res['status']} in {res['latency_ms']}ms")
    results["pages"] = page_results

    # 2. AI Chat Endpoint
    print("\n--- 2. Testing AI Engine & Clinical Triage Endpoint (/api/ai/chat) ---")
    
    ai_scenarios = [
        {
            "name": "General Dermatology Consultation / Doctor Verification",
            "payload": {
                "message": "Who is the consulting doctor here and what treatments do you offer?",
                "conversationHistory": []
            },
            "expect_doctor": "Mrinalini",
            "forbid_emojis": True
        },
        {
            "name": "Clinic Timings Inquiry",
            "payload": {
                "message": "What are your clinic opening hours and Sunday timings?",
                "conversationHistory": []
            },
            "expect_keywords": ["10", "7", "Sunday"],
            "forbid_emojis": True
        },
        {
            "name": "Severe Anaphylaxis / Emergency Triage",
            "payload": {
                "message": "URGENT: My face is swelling up and I have difficulty breathing after taking a new medication!",
                "conversationHistory": []
            },
            "expect_emergency": True,
            "forbid_emojis": True
        },
        {
            "name": "Appointment Booking Request",
            "payload": {
                "message": "I would like to schedule an appointment for acne treatment tomorrow at 11 AM",
                "conversationHistory": []
            },
            "expect_keywords": ["appointment", "Dr. Mrinalini"],
            "forbid_emojis": True
        },
        {
            "name": "Phone Number Request Prohibition Check",
            "payload": {
                "message": "Can I book a consultation for chemical peel on Friday at 4 PM?",
                "conversationHistory": []
            },
            "forbid_phone_prompt": True,
            "forbid_emojis": True
        }
    ]

    import re
    emoji_pattern = re.compile(
        r"[\U00010000-\U0010ffff]|[\u2600-\u27bf]|[\u2300-\u23ff]|[\u2b50]|[\u2b55]|[\u3030]|[\u303d]"
    )

    ai_results = []
    for sc in ai_scenarios:
        res = test_url("/api/ai/chat", method="POST", data=sc["payload"])
        passed = False
        reply = ""
        emojis_found = []
        asked_phone = False
        
        if res["status"] == 200:
            try:
                parsed = json.loads(res["body"])
                reply = parsed.get("reply", "") or parsed.get("content", "")
                
                # Check emojis
                emojis_found = emoji_pattern.findall(reply)
                has_no_emojis = len(emojis_found) == 0

                # Check phone prompt
                phone_phrases = ["your phone number", "your contact number", "phone number please", "mobile number"]
                asked_phone = any(p in reply.lower() for p in phone_phrases)

                # Check doctor if required
                doc_ok = True
                if "expect_doctor" in sc:
                    doc_ok = sc["expect_doctor"].lower() in reply.lower()
                
                # Check keywords if required
                kw_ok = True
                if "expect_keywords" in sc:
                    kw_ok = all(k.lower() in reply.lower() for k in sc["expect_keywords"])

                # Check emergency
                emerg_ok = True
                if sc.get("expect_emergency"):
                    emerg_ok = any(e in reply.lower() for e in ["emergency", "urgent", "casualty", "immediate", "hospital", "er"])

                passed = has_no_emojis and (not asked_phone) and doc_ok and kw_ok and emerg_ok
            except Exception as e:
                res["error"] = f"JSON parse error: {e}"
                passed = False

        status_sym = "PASS" if passed else "FAIL"
        print(f"[{status_sym}] {sc['name']}: HTTP {res['status']} ({res['latency_ms']}ms)")
        print(f"       AI Response snippet: {reply[:120]}...")
        if emojis_found:
            print(f"       [!] WARNING: Emojis detected: {emojis_found}")
        if asked_phone:
            print(f"       [!] WARNING: AI requested phone number!")
        
        ai_results.append({
            "name": sc["name"],
            "status": res["status"],
            "latency_ms": res["latency_ms"],
            "reply": reply,
            "emojis_found": emojis_found,
            "asked_phone": asked_phone,
            "passed": passed,
            "error": res["error"]
        })
    results["ai"] = ai_results

    # 3. Webhook Endpoint Verification
    print("\n--- 3. Testing WhatsApp Webhook GET & Verification Handshake ---")
    webhook_get = test_url("/api/whatsapp/webhook")
    print(f"[*] Webhook GET without params: HTTP {webhook_get['status']} (Expected 400 Bad Request / Verification check)")

    # 4. Save results to JSON file
    with open("live_verification_report.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("\n=== Live Verification Complete ===")

if __name__ == "__main__":
    run_tests()
