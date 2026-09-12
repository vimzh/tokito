# Tokito — Google Forms, but for phone calls

*Paraphrase and refinement of the original rough sketch and the founder’s latest clarification. This describes the intended product, not features already built or results already proven.*

## The idea

Tokito helps anyone run a phone campaign to collect feedback, understand people’s needs, or gather information. Tell it what you want to learn in plain language, upload an Excel file of contacts, and Tokito drafts the questions and calls them. The AI assistant asks follow-up questions to understand their answers, then turns the conversations into a detailed report that helps you decide what to do next.

For example, a restaurant owner could say: “We changed our menu. I want to know what customers think of it and what we should improve.” The owner does not need to build a Google Form or write every question first.

You can manage the same work through a Discord agent or a web dashboard: describe what you want to learn, review the generated questions, add contacts, start or pause calls, check progress, read answers, and ask for a report.

The simplest description is:

> **Google Forms, but people answer your questions over a phone call.**

## Why I want to build it

I run a society. We need members to provide information and give feedback on the events we organize. Sending a form does not always work: people forget, put it off, or never bother to fill it out. Some also struggle to answer parts of the form.

That leaves us chasing people individually and working with incomplete information. Even when answers arrive, someone still needs to read them and work out what to do next.

Tokito would handle the calls and organize the replies. A person could answer a few questions in conversation instead of remembering to open a link and finish a form.

Whether people are more willing to answer calls than forms is something to test. The product should make that comparison possible rather than assume calls will always work better.

## Who it is for

Tokito is for individuals, teams, and organizations that have people to contact and something they want to learn. A campaign brings together a goal, a contact list, conversations, and a report. The people answering might be customers, members, attendees, students, volunteers, or residents.

These are illustrative examples of who we are building it for:

| Who | Example campaign prompt | What the report helps them understand |
| --- | --- | --- |
| Small business owners | “We changed our restaurant menu. Find out what customers think.” | Reactions to dishes, prices, portions, and missing choices. |
| Society and club organizers | “Ask members what activities they want next term.” | Interests, preferences, and reasons behind them. |
| Event organizers | “Call attendees and find out what worked and what we should improve.” | Feedback on sessions, arrangements, and the overall experience. |
| Product teams and founders | “Ask people who tried our new feature what helped and where they got stuck.” | Useful features, confusing steps, and unmet needs. |
| Customer service teams | “Follow up with customers after their service visit.” | Whether the issue was resolved and what still needs attention. |
| Educators and training providers | “Ask participants how the workshop went and what needs more explanation.” | Learning difficulties, useful topics, and suggestions for future sessions. |
| Nonprofits and volunteer coordinators | “Ask volunteers about their availability and what support they need.” | Availability, preferred roles, and support requests. |
| Community and residents’ groups | “Find out which shared facilities residents want improved and why.” | Common concerns, differing priorities, and supporting reasons. |
| Researchers and independent project creators | “Ask this group about the problem I’m exploring and how they handle it today.” | Current habits, practical difficulties, and concrete examples. |

The society experience is the original motivation. The restaurant scenario below is one detailed example of the broader product. Each campaign uses the same flow: describe the goal, review the questions, contact people, ask relevant follow-ups, and understand the results.

## How it works

1. **Describe what you want input on.** Explain the change or decision in your own words and add useful background. Tokito drafts relevant questions for you to review or edit; writing your own questions is optional.
2. **Upload the contact list.** Import an Excel file containing names and phone numbers. Review missing or invalid numbers and duplicates before starting. Extra columns can provide relevant context.
3. **Review the calls.** Check who will be called, what they will be asked, the language, calling hours, maximum call length, and limits on repeat attempts.
4. **Start from Discord or the dashboard.** The AI assistant calls the selected people and explains who it is calling for and why.
5. **Let people answer naturally.** The assistant asks the questions, repeats or explains them using the campaign organizer’s supplied context, and asks follow-up questions to understand reasons, examples, and details that matter to the campaign’s goal.
6. **Track the results.** See who answered, who completed the questions, who needs a callback, and who could not be reached.
7. **Read the detailed report.** See what people said, the reasons behind their answers, recurring patterns, differences in opinion, requested information, and suggested next steps supported by their answers.

The assistant must not invent an answer when someone skips a question, declines, or does not know. Those gaps should remain visible.

## A restaurant menu example

A restaurant has changed its menu and wants to understand how customers feel about it. The owner uploads an Excel file of customer contacts and prompts Tokito through Discord or the dashboard:

> We changed our menu. I want input on the new dishes, the choices available, and the prices. Find out what customers like and what we should improve.

Tokito uses that goal to draft questions for review, such as:

- Have you tried the updated menu? Which dishes did you order?
- What did you like or dislike about those dishes?
- How did you feel about the choices available?
- What did you think of the prices for what you received?
- Is there anything you would change or bring back?

These are example questions, not a fixed script. Someone who has not tried the new menu should not be treated as if they have.

During a call, the agent follows the customer’s answer:

> **Assistant:** What did you think of the new menu?
>
> **Customer:** It felt expensive.
>
> **Assistant:** Which dish felt expensive, and what made it feel that way?
>
> **Customer:** The pasta. The portion was smaller than I expected for the price.
>
> **Assistant:** How did the portion compare with what you expected?

The conversation goes beyond a rating and captures the reason behind it. Follow-ups should explore relevant details without leading the customer toward a particular answer or repeatedly asking something they have already explained.

The owner receives a detailed report covering dishes customers discussed, what they enjoyed, concerns about price or portions, missing choices, and reasons behind those opinions. Each finding should include supporting answers and how often it came up. Conflicting opinions and unanswered questions should remain visible.

The owner can then ask:

> Which dishes received the most criticism, and why?
>
> Are price complaints about the price itself or the portion size?
>
> What should we consider changing, based on these conversations?

This is an illustrative scenario, not a claim that these calls or findings already exist. The society version follows the same pattern: describe the event feedback needed, let Tokito draft questions, call attendees, and report what they said.

## What the product should include

### Questions and contact lists

- Generate a questionnaire from a plain-language request and supporting context.
- Let the campaign organizer review, edit, add, or remove questions before outreach.
- Support direct answers such as ratings or choices as well as open questions.
- Import Excel files and let the organizer confirm which columns contain names and phone numbers.
- Show contact problems clearly before calling.
- Let the organizer choose whether clarification questions are allowed and keep them within the questionnaire’s purpose.

### Phone conversations

- Identify the AI assistant, the organization, and the reason for calling.
- Ask the prepared questions in a natural conversation.
- Repeat a question or clarify it using approved context when asked.
- Ask follow-up questions about reasons, examples, and relevant details based on what each person says.
- Go deeper when an answer matters to the campaign’s goal, within the agreed call length and the person’s willingness to continue.
- Respect skipped questions, refusals, requests to stop, and opt-outs.
- Handle no answer, disconnected calls, and callback requests with visible outcomes.
- Limit call length and repeat attempts, and avoid duplicate calls.

The calling service is CALL-E (heycall-e.com), chosen on September 13, 2026 in place of the Twilio or Vapi options from the original sketch. See the Phase 5 notes in docs/phases/README.md.

### Web dashboard

- Describe a feedback goal, review generated questions, upload contacts, and start or pause outreach.
- See active and completed questionnaires and progress for each one.
- View each person’s call status and completed or missing answers.
- Read call transcripts, short summaries, and any requested follow-up.
- Review reports and ask questions about the collected answers.
- Export answers and reports in a useful format; the exact formats remain to be decided.

### Discord agent

Discord is another way to manage the same questionnaires and results, not just a place for notifications.

- Describe what feedback is needed, review generated questions, and upload contact lists.
- Review and start outreach, or pause it.
- Ask how calls are progressing.
- Look up answers and ask what people said about a topic.
- Request a report.
- Receive meaningful updates, including completion or a problem needing attention.

Changes made in Discord should be reflected in the dashboard, and vice versa.

### Answers and reports

For each person, show their answers, call outcome, short summary, and any unanswered questions or follow-up requests. Keep transcripts available for checking what was actually said. Recordings are an option only with appropriate permission and handling.

For the whole questionnaire, show:

- How many people were contacted, reached, and completed the questions.
- How many answers each question received, including partial responses.
- Ratings or choice totals where those questions were asked.
- Common feedback, positive comments, problems, and suggestions, including the reasons and examples behind them.
- How often each theme appears, using clear counts of the people who answered.
- Differences and disagreements between answers, with relevant participant context when available.
- A detailed breakdown of the topics the campaign covers, such as menu choices, event arrangements, product usability, or volunteer availability.
- Supporting answers for each reported theme.
- People who requested a callback or help from the organizer.
- Suggested next steps, clearly labeled as suggestions from the AI.

Reports must distinguish people’s actual statements from AI summaries and interpretations. They should explain missing responses and avoid treating the people who answered as representative of everyone automatically.

## Connections to other apps

The core experience is **Describe the goal → generated questions + Excel contacts → calls with follow-ups → detailed report**, available through Discord and the dashboard.

The original sketch also proposed these connections. They remain useful options, not a finalized commitment to every service:

| App | What it would add |
| --- | --- |
| Google Sheets | Read a shared contact list and write back answers and call statuses. |
| Google Calendar | Keep track of agreed callbacks or human follow-up appointments. |
| Notion | Publish a readable report where the team already keeps its documents. |
| HubSpot or another customer tool | Use relevant customer context and save feedback back to customer records. |
| Gmail | Send agreed follow-up information or reminders. |
| Linear | Turn reviewed, well-supported product feedback into a task for a product team. |

These connections should support one complete workflow. The final selection should reflect the chosen campaign use case and the verified hackathon requirements in [hackathon.md](hackathon.md). The dashboard itself is part of Tokito, not an external app connection.

Callbacks are useful even before choosing a calendar service. Tokito should only promise a callback when it has successfully scheduled one, and should show failures clearly.

## Trust and control

- Organizers must have an appropriate basis to contact the people they upload.
- Explain AI calling and any recording or transcription clearly, and obtain permission where required.
- Respect calling hours, opt-outs, and limits on repeat attempts.
- Protect contact details and answers, restrict access, and provide deletion and retention controls.
- Never pressure someone into answering or pretend to be a human.
- Do not promise actions the system has not successfully arranged.
- Make failed calls, partial answers, and failed app updates visible.
- Keep conclusions traceable to the answers behind them.

The specific calling and consent requirements depend on where the product is used and need to be confirmed before real outreach.

## What success looks like

A campaign organizer can describe what they want to learn, review Tokito’s generated questions, upload an Excel contact list, and start outreach. They can follow progress in Discord or the dashboard and receive a detailed, understandable report explaining what people said, why, and what actions the evidence suggests, without writing every question or manually summarizing every reply.

People can answer briefly, ask for clarification, skip a question, or stop the call. The system captures their answers accurately and respects those choices.

We should test whether this saves organizer effort and improves useful responses compared with the organizer’s current form process. Useful measures include completion, answer accuracy, time spent by the organizer, call length and cost, and opt-outs. No improvement target has been established yet.

## Decisions still to make

- What background should campaign organizers provide so Tokito can ask informed questions about their topic and audience?
- Which languages and calling regions should be supported first?
- Which external app connections belong in the hackathon build?
- How should callers request and confirm callback times?
- Which answer and report export formats are needed?
- What access, retention, and recording choices should organizers have?
- What calling cost and contact-list size should the first version support?

This brief is not reduced to fit a hackathon time budget. It keeps the confirmed product experience separate from integration choices and questions that still need answers.
