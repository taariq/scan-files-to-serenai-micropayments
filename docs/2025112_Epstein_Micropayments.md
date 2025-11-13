# A Files Scan/Extract/Upload MicroPayments App using SerenAI

## Business Case:
SerenAI is exploring launch marketing that will accomplish the following:

1. Use SerenAI back-end SerenDB
2. Be an Open-Source application anyone can use
3. Allow users to create SerenDB console accounts
4. Allow users to register their SerenDB databases as x402 endpoints using the SerenDB gateway here: /Users/taariqlewis/Projects/Seren_Projects/serenai-x402
5. Allow users to have their LLMs pay for queries.

I have downloaded a number of images and text files from the oversight committee. Links are here and the files are in this repo
https://oversight.house.gov/release/oversight-committee-releases-epstein-records-provided-by-the-department-of-justice/
https://oversight.house.gov/release/oversight-committee-releases-additional-epstein-estate-documents/

This information is in images and other file formats which are not easy to read. As a user, I am not able to quickly figure out what's in the files. A search would be great, but given that many files are images, it's not easy to parse what is actually in the files and whether they are important. This woudl be an ideal solution for a micropayments connected to scanned document content in SerenDB's database.

## The solution
We want to create an open-source application that anyone can 
1. Scan their image and text files
2. Upload the content from these files, not the files themselves, into SerenDB via PSQL link
3. Register the databse table with SerenDB x402 database and endpoint
4. Generate an x402 link
5. Use that link to send SQL queries to get information.
6. Implement an MCP server to make it easy to connect to LLMs.
7. When new files come out, a workflow to scan and upload their contents to SerenDB.
8. A blog post demonstrating this feature of SerenAI and inviting anyone to make micropayment queries.

## Success
1. We want to build this functionality tonight and launch it for testing in 2.5 hours.	
2. We'll need a walk through to understand the required features and scope
3. We'll need an implementation plan and github tickets.
4. We will want to develoop this in SolidJS since SerenDB will be using SolidJS and NOT react.

## Requirements
1. We will need to be able to run a free/open-source text extraction tool to convert images into text and then prepare them for upload
2. We will need a SerenAI production database endpoint
3. We will need to be able to dump our databsase because the SerenAI production databases will be reset so we don't want to re-scan
4. We will need to setup x402 payments db on production as well. Ouch!
5. We will need to come up with pricing for queries given the size of the data and interest in using it. We expect to charge some equivalent of ad-revenue from the average newspaper publisher that covering the story.
6. The Epstein_Files are in the docs folder which we want to add to .gitignore so that the files are not pushed to the github repo
7. We will need to create a README demonstrating how this works.
8. Use /Users/taariqlewis/Projects/Seren_Projects/serenai-x402 to provision our Payment endpoint.