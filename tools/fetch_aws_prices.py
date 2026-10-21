"""Fetch indicative AWS EC2 prices per vCPU-hour for the compute planner.

    python3 tools/fetch_aws_prices.py        # writes web/public/data/aws_prices.json

Sources (public, no credentials):
- On-demand: the price-list feed behind aws.amazon.com/ec2/pricing/on-demand (Linux, per region).
- Spot: the feed behind aws.amazon.com/ec2/spot/pricing. Spot prices move continuously; the
  snapshot is only indicative.

Only x86 compute-optimised families are kept: the SFINCS container image is amd64-only.
Prices per vCPU-hour are the median over the sizes of a family.
"""

from __future__ import annotations

import gzip
import json
import re
import statistics
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "web" / "public" / "data" / "aws_prices.json"
FAMILIES = re.compile(r"^(c6a|c6i|c7a|c7i|c8a|c8i)\.")
REGIONS = {  # API code -> name used by the on-demand feed
    "us-east-1": "US East (N. Virginia)",
    "eu-west-1": "EU (Ireland)",
    "af-south-1": "Africa (Cape Town)",
}
ONDEMAND = ("https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/"
            "ec2-ondemand-without-sec-sel/{region}/Linux/index.json")
SPOT = "https://website.spot.ec2.aws.a2z.com/spot.js"


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "price-fetch"}),
                                timeout=60) as r:
        raw = r.read()
    try:
        return gzip.decompress(raw)
    except OSError:
        return raw


def main() -> None:
    retrieved = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    spot_txt = get(SPOT).decode()
    spot = json.loads(spot_txt[spot_txt.index("(") + 1: spot_txt.rindex(")")])
    spot_by_region = {r["region"]: r for r in spot["config"]["regions"]}

    out, published = {}, None
    for code, name in REGIONS.items():
        od = json.loads(get(ONDEMAND.format(region=urllib.parse.quote(name))))
        published = published or od["manifest"].get("hawkFilePublicationDate")
        items = next(iter(od["regions"].values()))
        per_family: dict[str, dict[str, list[float]]] = {}
        for v in items.values():
            t = v.get("Instance Type", "")
            if FAMILIES.match(t) and v.get("Operating System") == "Linux":
                per_family.setdefault(t.split(".")[0], {"od": [], "spot": []})["od"].append(
                    float(v["price"]) / int(v["vCPU"]))
                per_family[t.split(".")[0]].setdefault("vcpu", {})[t] = int(v["vCPU"])
        for it in spot_by_region.get(code, {}).get("instanceTypes", []):
            for sz in it["sizes"]:
                fam = sz["size"].split(".")[0]
                vcpu = per_family.get(fam, {}).get("vcpu", {}).get(sz["size"])
                price = next((c["prices"]["USD"] for c in sz["valueColumns"] if c["name"] == "linux"), None)
                if vcpu and price and not price.startswith("N/A"):
                    per_family[fam]["spot"].append(float(price) / vcpu)
        out[code] = {"name": name, "families": {
            f: {"on_demand": round(statistics.median(p["od"]), 5),
                "spot": round(statistics.median(p["spot"]), 5) if p["spot"] else None}
            for f, p in sorted(per_family.items())}}

    OUT.write_text(json.dumps({
        "on_demand_published": published, "spot_retrieved": retrieved,
        "sources": {"on_demand": "https://aws.amazon.com/ec2/pricing/on-demand/",
                    "spot": "https://aws.amazon.com/ec2/spot/pricing/"},
        "unit": "USD per vCPU-hour, Linux, median over instance sizes",
        "regions": out}, indent=1))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
