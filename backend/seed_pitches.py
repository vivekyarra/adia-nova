"""Historical pitch summaries for FAISS-based similar decision lookup."""

SEED_PITCHES = [
    {
        "name": "Airbnb (2009 Seed Round)",
        "outcome": "GO — $600B+ valuation, disrupted global hospitality",
        "summary": (
            "Platform connecting travelers with homeowners who rent spare rooms. "
            "Founded by design school graduates with no hospitality experience. "
            "Revenue $200/week from 800 listings. Competitors include hotels, VRBO, Craigslist. "
            "Team had no technical co-founder initially. $20K revenue, growing 30% week over week. "
            "TAM estimated at $40B vacation rental market. Key risk: regulatory pushback from cities. "
            "Key moat: network effects and user trust via reviews."
        ),
        "lesson": "Non-obvious markets with massive latent supply can create category-defining companies. Early traction > perfect team credentials.",
    },
    {
        "name": "Uber (2010 Seed Round)",
        "outcome": "GO — $75B+ IPO, created ride-hailing category",
        "summary": (
            "On-demand black car service via mobile app. San Francisco only at launch. "
            "Premium pricing 2-3x taxis. Team: serial entrepreneur CEO, strong engineering co-founder. "
            "$1.25M seed raise. Revenue from 6K rides/month in SF. Burn rate $50K/month. "
            "Key risk: taxi commission regulations, driver supply constraints. "
            "TAM: $100B global taxi and limousine market. No patents or technical moat. "
            "Competitor defense: geographic expansion speed and driver network density."
        ),
        "lesson": "Regulatory risk does not disqualify — execution speed and market timing matter more. First-mover advantage in network-effect businesses is decisive.",
    },
    {
        "name": "WeWork (2012 Series A)",
        "outcome": "NO-GO — $47B to $8B valuation collapse, failed IPO",
        "summary": (
            "Co-working space provider leasing floors in buildings and subletting desks. "
            "Revenue $4.8M ARR growing 100%+ annually. Burn rate $2.5M/month with 18 locations planned. "
            "Team: charismatic CEO with real estate background but no tech experience. "
            "TAM claim: $3T commercial real estate market. No technology moat — pure real estate arbitrage. "
            "Key risks: long-term lease obligations vs short-term member contracts, negative unit economics, "
            "governance concerns with founder control. LTV/CAC never demonstrated at scale."
        ),
        "lesson": "Revenue growth without unit economic validation is a trap. Charismatic founders with governance red flags are the highest-risk failure mode in late-stage investing.",
    },
    {
        "name": "Theranos (2004 Series A)",
        "outcome": "NO-GO — $9B to $0, criminal fraud conviction",
        "summary": (
            "Blood testing device claiming to run 200+ lab tests from a single finger prick. "
            "Founded by 19-year-old Stanford dropout. No working prototype shown to investors. "
            "Revenue: $0 — entirely pre-product. Team: prestigious board members but no medical device experts. "
            "TAM: $75B laboratory diagnostics market. No peer-reviewed validation of core claims. "
            "Key risks: unverified technology claims, no published clinical data, founder refused live demos. "
            "Red flags: stealth mode beyond reasonable duration, no technical co-founder, "
            "claims violate known physics constraints of blood sample volumes."
        ),
        "lesson": "Any startup refusing technical validation or peer review is a fatal red flag. Board prestige does not substitute for domain expertise in deep-tech claims.",
    },
    {
        "name": "Stripe (2011 Seed Round)",
        "outcome": "GO — $95B valuation, dominant payment infrastructure",
        "summary": (
            "Developer-first payment processing API. 7 lines of code to accept payments vs months of bank integration. "
            "Founded by two Irish brothers, repeat YC founders. Revenue: $0 at seed, pre-launch. "
            "Team: Patrick Collison (19, published programmer since 15), John Collison (17, MIT). "
            "TAM: $1.5T global payment processing market. Competitors: PayPal, Braintree, Authorize.net. "
            "Key risk: PCI compliance complexity, banking relationship requirements, fraud liability. "
            "Key moat: developer experience as distribution channel, switching costs after integration."
        ),
        "lesson": "Developer-first products with massive switching costs can dominate even in mature markets. Technical founders solving their own pain point is the strongest signal.",
    },
]
