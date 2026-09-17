# AquaDesk Presentation Flow

Use this as a FigJam/Figma-ready flow for presenting the web app. The Mermaid diagram can be pasted into FigJam using a Mermaid/diagram widget, or recreated as frames in Figma.

## Main Demo Flow

```mermaid
flowchart LR
  start["Manager demo starts"] --> login["Login"]
  login --> role{"User role"}

  role --> agent["Agent workspace"]
  role --> teamLead["Team Lead dashboard"]
  role --> quality["Quality review"]

  agent --> kbSearch["Search knowledge cards"]
  agent --> support["Raise support request"]
  agent --> ticketCreate["Create customer ticket"]
  agent --> liveCall["Live call with Chrome extension"]

  kbSearch --> policyCard["Open approved policy card"]
  support --> tlPopup["Team Lead and Quality receive request notification"]
  ticketCreate --> duplicateCheck{"Same customer name and phone?"}

  duplicateCheck -->|"No"| ticketQueue["Ticket queue"]
  duplicateCheck -->|"Yes"| mergePrompt["Duplicate warning and merge option"]
  mergePrompt --> editRequest["Agent requests one-time edit permission"]
  editRequest --> reviewerApproval["Team Lead or Quality approves"]
  reviewerApproval --> ticketUpdate["Agent edits and merges details"]
  ticketQueue --> ticketStatus["Track status: open, active, resolved"]

  liveCall --> transcript["Transcript captured"]
  liveCall --> wrongInfo{"Wrong info or critical phrase?"}
  wrongInfo -->|"Yes"| agentAlert["Agent popup opens correct knowledge card"]
  wrongInfo -->|"Yes"| flagCreated["Quality flag and critical ticket created"]
  wrongInfo -->|"No"| continueCall["Call continues normally"]
  transcript --> afterCall["After-call AI report"]

  afterCall --> reportSections["Summary, soft skills, wrong info, full transcript, recommendations"]
  reportSections --> teamLead
  reportSections --> quality

  teamLead --> manageSupport["Review support requests"]
  teamLead --> manageKnowledge["Manage knowledge base"]
  teamLead --> manageTickets["Approve ticket edits and monitor queue"]
  teamLead --> manageUsers["Create, edit, deactivate users"]

  quality --> reviewFlags["Review critical and soft-skill flags"]
  quality --> reviewReports["Review after-call reports"]
  quality --> updateRules["Maintain phrases and quality rules"]

  manageSupport --> coaching["Coaching and operational follow-up"]
  reviewFlags --> coaching
  reviewReports --> coaching
  manageTickets --> coaching
```

## Presenter Story

1. Start with login and role-based access.
   - Agents, Team Lead, and Quality see different workspaces.
   - Team Lead controls users, tickets, support requests, and knowledge setup.

2. Show the agent workspace.
   - Agent searches approved knowledge cards.
   - Agent can raise a support request while working with a customer.
   - Team Lead and Quality receive the request and can follow up.

3. Show ticket creation and duplicate protection.
   - Agent creates a customer ticket with mandatory fields.
   - If same customer name and phone already exist, the app warns about a duplicate.
   - Agent can open the existing ticket or request one-time edit permission to merge details.

4. Show the live call extension.
   - Extension captures transcript during a Maqsam/live call.
   - If wrong information or a critical phrase is detected, the agent receives a popup.
   - The popup opens the correct knowledge card so the agent can correct the answer during the call.

5. Show after-call reporting.
   - After the call, AI creates a report.
   - Report includes summary, soft skills, wrong info, full transcript, and recommendations.
   - Team Lead and Quality use the report for coaching and QA follow-up.

6. Close with the management loop.
   - Knowledge cards, phrase rules, user access, tickets, and coaching all stay connected.
   - The system turns live calls into tracked actions, QA signals, and manager visibility.

## Figma Frame Suggestions

- Frame 1: Login and role split
- Frame 2: Agent workspace and knowledge search
- Frame 3: Live call extension popup
- Frame 4: Ticket creation, duplicate warning, one-time edit approval
- Frame 5: Team Lead dashboard
- Frame 6: Quality review and after-call report
- Frame 7: End-to-end operational loop

## Demo Script

"AquaDesk connects the agent workflow, live-call guidance, ticket handling, and quality review in one system. The agent works from approved knowledge cards and creates tickets with duplicate protection. During live calls, the extension captures transcript text and can warn the agent when wrong information is given, opening the right knowledge card immediately. After the call, the transcript is analyzed into a full report for Team Lead and Quality, including wrong info, soft-skill findings, and recommendations. Team Lead can manage users, knowledge, support requests, tickets, and coaching from the same operational view."
