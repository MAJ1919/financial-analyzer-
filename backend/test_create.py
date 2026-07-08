import requests
import json

url = "http://localhost:8000/api/projects/"
payload = {"company_name": "aa", "currency": "SAR"}
headers = {"Content-Type": "application/json"}

try:
    response = requests.post(url, json=payload, timeout=5)
    print("STATUS:", response.status_code)
    print("BODY:", response.text)
except Exception as e:
    print("ERROR:", str(e))
