SatyaVaani - The WhatsApp Fact-Checker

Problem Statement

In the age of "WhatsApp University," misinformation spreads rapidly, particularly among vulnerable populations. This project aims to combat this by providing a simple, integrated tool for fact-checking messages directly within WhatsApp Web, promoting digital literacy as envisioned by the 'Smart India' mission.

Our Solution

SatyaVaani is a browser extension that adds a "Fact-Check" button to messages on web.whatsapp.com. Using a powerful NLP backend, it compares message content against a database of known misinformation to provide a real-time veracity score.

Architecture

    Frontend: A Chrome browser extension built with JavaScript.

    Backend: A Python Flask API that uses Sentence-Transformers for semantic text similarity analysis.

    Data Source: A curated list of debunked news from reliable sources like PIB Fact Check.

How to Run

Backend

    cd backend

    pip install -r requirements.txt

    python app.py

Extension

    Open Chrome and navigate to chrome://extensions.

    Enable "Developer mode".

    Click "Load unpacked" and select the extension folder.

    Open web.whatsapp.com.