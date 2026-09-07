# Soft-Skill AI Gap

## Current state

AquaDesk's live Tier 2 soft-skill check uses the same phrase-matching mechanism as the Tier 1 critical check. The difference is classification and behavior: Tier 2 records are tagged `soft_skill` and logged silently, while critical matches trigger an immediate warning. The extension stores only the short matched snippet and does not preserve the full call transcript.

This means the current Tier 2 result can identify configured phrases, but it cannot judge the tone, empathy, ownership, clarity, or overall flow of an entire customer conversation.

## Original intent

The intended Tier 2 design is a post-call quality review in which an AI model evaluates the full call transcript after the call ends. That wider context is needed to assess soft skills across the conversation instead of treating one phrase as the complete interaction.

## Decision required

Closing this gap requires a human privacy and retention decision before further implementation:

1. Store full call transcripts for post-call AI analysis. This requires an approved purpose, access policy, retention period, deletion process, consent or notice requirements, and a review of where transcript and AI data are processed.
2. Keep the existing snippet-only design. This preserves data minimization, but soft-skill detection remains phrase-based and cannot provide a complete post-call quality assessment.

This document does not choose either option. Product, operations, privacy, and security owners should approve the transcript policy before full-transcript capture or post-call AI analysis is built.
