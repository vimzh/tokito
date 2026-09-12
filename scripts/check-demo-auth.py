"""Check demo authentication against the running frontend using only the standard library."""

import http.cookiejar
import json
import sys
import urllib.parse
import urllib.request

base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4000"
cookies = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))


def request(path, data=None):
    payload = urllib.parse.urlencode(data).encode() if data is not None else None
    req = urllib.request.Request(base + path, data=payload)
    if payload is not None:
        req.add_header("X-Auth-Return-Redirect", "1")
    return client.open(req)


def session():
    return json.load(request("/api/auth/session"))


def login(email, password):
    csrf = json.load(request("/api/auth/csrf"))["csrfToken"]
    return json.load(request("/api/auth/callback/credentials", {
        "csrfToken": csrf, "email": email, "password": password,
        "callbackUrl": base + "/home",
    }))


assert session() is None
for path in ["/home", "/connections", "/settings", "/survey/new"]:
    assert request(path).geturl() == base + "/"
for email, password in [("demo@theategmail.com", "wrong"),
                        ("wrong@example.com", "demo1234"), ("", "")]:
    assert "error=CredentialsSignin" in login(email, password)["url"]
    assert session() is None

assert login("demo@theategmail.com", "demo1234")["url"] == base + "/home"
assert session()["user"]["email"] == "demo@theategmail.com"
assert request("/home").geturl() == base + "/home"
assert 'href="/survey/new"' in request("/home").read().decode()
assert "Who writes the questions?" in request("/survey/new").read().decode()
assert ">Home</a>" in request("/").read().decode()
token = next(cookie for cookie in cookies if cookie.name.endswith("session-token"))
assert token.has_nonstandard_attr("HttpOnly")
assert len(token.value.split(".")) == 5  # Auth.js uses encrypted JWT sessions.
token.value = "tampered-session"
assert session() is None
for path in ["/home", "/connections", "/settings", "/survey/new"]:
    assert request(path).geturl() == base + "/"

login("demo@theategmail.com", "demo1234")
csrf = json.load(request("/api/auth/csrf"))["csrfToken"]
request("/api/auth/signout", {"csrfToken": csrf, "callbackUrl": base + "/"})
assert session() is None
print("Passed: invalid credentials, login, Home button, HTTP-only JWT, tamper rejection, and logout.")
