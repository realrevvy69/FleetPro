"""FleetPro calendar iCal export tests (feed token, feed, single event .ics)"""
import os
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
import requests
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]
API = f"{BASE_URL.rstrip('/')}/api"
TODAY = datetime.now(ZoneInfo("Europe/Berlin")).date()


def d(n):
    return (TODAY + timedelta(days=n)).isoformat()


def unfold(body):
    return body.replace("\r\n ", "")


def vevents(body):
    return re.findall(r"BEGIN:VEVENT\r\n(.*?)END:VEVENT", unfold(body), re.S)


@pytest.fixture(scope="module")
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


@pytest.fixture(scope="module")
def data(s):
    r = s.post(f"{API}/vehicles", json={"brand": "TEST_Ical", "model": "Golf", "license_plate": "TEST-ICS1", "mileage": 20000})
    assert r.status_code == 200
    v = r.json()
    ids = {}
    long_note = "TEST_note, with comma; and semicolon " + "äöü long text " * 8
    for key, p in {
        "timed": {"type": "handover", "date": d(3), "time": "09:30", "driver_name": "TEST_Max", "notes": long_note},
        "untimed": {"type": "return", "date": d(4)},
        "far": {"type": "pool_exit", "date": d(800)},
        "past": {"type": "handover", "date": d(-200)},
        "late": {"type": "return", "date": d(5), "time": "23:30"},
    }.items():
        r = s.post(f"{API}/calendar/events", json={"vehicle_id": v["id"], **p})
        assert r.status_code == 200, r.text
        ids[key] = r.json()["id"]
    # mark one done directly via DB-less path: use protocol? simpler: DB update
    from pymongo import MongoClient
    env = dotenv_values("/app/backend/.env")
    mdb = MongoClient(env["MONGO_URL"])[env["DB_NAME"]]
    r = s.post(f"{API}/calendar/events", json={"vehicle_id": v["id"], "type": "handover", "date": d(6)})
    ids["done"] = r.json()["id"]
    mdb.calendar_events.update_one({"id": ids["done"]}, {"$set": {"done": True}})
    r = s.post(f"{API}/maintenance/schedules", json={"vehicle_id": v["id"], "name": "TEST_Oil", "type": "mileage",
                                                     "interval_value": 10000, "last_done_mileage": 5000})
    assert r.status_code == 200, r.text
    ids["sched"] = r.json()["id"]
    yield v, ids, long_note
    s.delete(f"{API}/maintenance/schedules/{ids['sched']}")
    s.delete(f"{API}/vehicles/{v['id']}")


@pytest.fixture(scope="module")
def token(s):
    r = s.get(f"{API}/calendar/feed-token")
    assert r.status_code == 200
    return r.json()["token"]


# Feed token
class TestFeedToken:
    def test_stable(self, s, token):
        t2 = s.get(f"{API}/calendar/feed-token").json()["token"]
        assert isinstance(token, str) and len(token) >= 20 and t2 == token

    def test_wrong_token_404(self, s):
        assert s.get(f"{API}/calendar/feed/nope-wrong.ics").status_code == 404


# Feed content
class TestFeed:
    def test_feed_content(self, s, token, data):
        v, ids, note = data
        r = s.get(f"{API}/calendar/feed/{token}.ics")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/calendar")
        body = r.text
        assert body.startswith("BEGIN:VCALENDAR\r\n") and body.endswith("END:VCALENDAR\r\n")
        assert "TZID:Europe/Berlin" in body and "BEGIN:VTIMEZONE" in body
        for line in r.content.split(b"\r\n"):
            assert len(line) <= 75, line
        assert "\n" not in body.replace("\r\n", "")
        evs = unfold(body)
        uids = re.findall(r"UID:(.*?)@fleetpro", evs)
        assert ids["timed"] in uids and ids["untimed"] in uids and ids["late"] in uids and ids["done"] in uids
        assert f"service-{ids['sched']}" in uids
        assert ids["far"] not in uids and ids["past"] not in uids
        assert len(uids) == len(set(uids))

    def test_timed_event(self, s, token, data):
        v, ids, note = data
        body = s.get(f"{API}/calendar/feed/{token}.ics").text
        ev = [e for e in vevents(body) if f"UID:{ids['timed']}@" in e][0]
        ds = d(3).replace("-", "")
        assert f"DTSTART;TZID=Europe/Berlin:{ds}T093000" in ev
        assert f"DTEND;TZID=Europe/Berlin:{ds}T103000" in ev
        assert "SUMMARY:Übergabe: TEST_Ical Golf (TEST-ICS1)" in ev
        assert "DESCRIPTION:Fahrer: TEST_Max\\n" in ev
        assert "TEST_note\\, with comma\\; and semicolon" in ev

    def test_untimed_done_service_late(self, s, token, data):
        v, ids, _ = data
        evs = vevents(s.get(f"{API}/calendar/feed/{token}.ics").text)
        un = [e for e in evs if f"UID:{ids['untimed']}@" in e][0]
        assert f"DTSTART;VALUE=DATE:{d(4).replace('-', '')}" in un
        assert f"DTEND;VALUE=DATE:{d(5).replace('-', '')}" in un
        assert "SUMMARY:Rückgabe: TEST_Ical Golf (TEST-ICS1)" in un
        dn = [e for e in evs if f"UID:{ids['done']}@" in e][0]
        assert "SUMMARY:✓ Übergabe:" in dn
        sv = [e for e in evs if f"UID:service-{ids['sched']}@" in e][0]
        assert "SUMMARY:Service: TEST_Ical Golf (TEST-ICS1)" in sv and "TEST_Oil" in sv
        assert f"DTSTART;VALUE=DATE:{TODAY.isoformat().replace('-', '')}" in sv
        late = [e for e in evs if f"UID:{ids['late']}@" in e][0]
        assert f"DTEND;TZID=Europe/Berlin:{d(6).replace('-', '')}T003000" in late


# Single event ics
class TestEventIcs:
    def test_manual(self, s, data):
        _, ids, _ = data
        r = s.get(f"{API}/calendar/events/{ids['timed']}/ics")
        assert r.status_code == 200 and r.headers["content-type"].startswith("text/calendar")
        assert "attachment" in r.headers.get("content-disposition", "") and ".ics" in r.headers["content-disposition"]
        evs = vevents(r.text)
        assert len(evs) == 1 and f"UID:{ids['timed']}@" in evs[0]

    def test_far_event_also_downloadable(self, s, data):
        _, ids, _ = data
        r = s.get(f"{API}/calendar/events/{ids['far']}/ics")
        assert r.status_code == 200 and len(vevents(r.text)) == 1

    def test_auto_service(self, s, data):
        _, ids, _ = data
        r = s.get(f"{API}/calendar/events/service-{ids['sched']}/ics")
        assert r.status_code == 200
        evs = vevents(r.text)
        assert len(evs) == 1 and "SUMMARY:Service:" in evs[0]

    def test_unknown_404(self, s):
        assert s.get(f"{API}/calendar/events/does-not-exist/ics").status_code == 404


# Reset token (run last)
class TestZReset:
    def test_reset(self, s, token):
        r = s.post(f"{API}/calendar/feed-token/reset")
        assert r.status_code == 200
        new = r.json()["token"]
        assert new != token
        assert s.get(f"{API}/calendar/feed/{token}.ics").status_code == 404
        assert s.get(f"{API}/calendar/feed/{new}.ics").status_code == 200
        assert s.get(f"{API}/calendar/feed-token").json()["token"] == new
