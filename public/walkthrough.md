# Cook Along — three-minute walkthrough

Use the actual application. Keep normal timer durations unchanged. If speech is unavailable, demonstrate the touch/keyboard fallback and say so. The illustrated storyboard is conceptual; it is not a recording of participant behavior.

## 0:00–0:25 · The problem

“Cook Along addresses the Messy Hands Cooking Mode brief. Imagine a tablet on a stable stand, hands occupied, and several tasks underway. The interface keeps three questions visible: what do I do now, how much do I need, and what needs attention next? Distance readability is a design goal; physical 3–5-foot testing is still needed.”

Show the main board and the comparison of full-recipe, focused-board and audio-led alternatives. Explain why the focused board was selected.

## 0:25–0:50 · Prepare

Open the recipe overview. Select four servings and point to the ingredient changes.

“Amounts derive from original quantities, so scaling back does not compound rounding. We choose the serving basis before cooking and lock it once ingredients might be added. Timing is not automatically scaled.”

Open setup. Explain optional voice and sound, then deliberately enable voice only if you intend to grant microphone consent.

## 0:50–1:25 · Read and move

Enter cooking mode. Point to the instruction, current-step quantities and fixed navigation.

If real recognition is available, say “Cook, next step” and show actual feedback. Otherwise use Next and explicitly state that this is the fallback, not live speech.

“Only a final bounded command can act. ‘Cook’ is a command prefix, not a true wake word. The interface shows listening, processing and speaking states; app speech pauses recognition to avoid self-triggering.”

Repeat the instruction, then stop speaking if needed.

## 1:25–1:55 · Parallel work

Start the available named timers and move to another step. Point to both names and countdowns.

“Timers belong to the session, independently of navigation. They use deadlines and recover remaining or overdue time after refresh. Each completion needs its own acknowledgement; silencing one leaves the others alone.”

Do not wait for normal durations to elapse during the three-minute presentation. Use the timer-attention screenshot to explain the completed state, and identify it as a captured state.

## 1:55–2:25 · Recovery

If live speech is functioning, try an unknown command. Show that the step remains unchanged. Otherwise show the unavailable/denied speech explanation without pretending a command was recognized.

“Failure keeps the current context and offers a short retry example. Touch and keyboard remain usable. Reload restores progress without restarting microphone capture.”

Refresh the page if the prepared session makes this easy to demonstrate. Resume and show preserved progress and timers.

## 2:25–3:00 · Finish honestly

Show the recipe completion state or its screenshot. Point out remaining timers.

“Completing instructions does not cancel unfinished tasks, and elapsed time is not proof of doneness. This is one authored, untested demonstration recipe. Automated domain and mocked speech tests verify software rules, not real-device recognition or five-foot readability. The case study records actual verification and its limits. AI assisted research synthesis, design, implementation and review.”

End at the case-study validation section. State the final recorded browser coverage exactly; do not claim hardware tests or participant results unless they have actually been completed.
