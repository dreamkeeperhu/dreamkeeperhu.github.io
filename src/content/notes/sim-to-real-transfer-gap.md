---
title: "The Sim-to-real Gap I Care About"
description: "A short note on why sim-to-real is less about one perfect simulator and more about reliable transfer under mismatch."
pubDate: 2026-05-16
updatedDate: 2026-05-17
thread: "sim-to-real"
series: "Robotics notes"
audience: "robotics readers"
difficulty: "intro"
category: research
tags:
  - robotics
  - sim-to-real
  - embodied intelligence
---

Robots learn in simplified worlds and act in messy ones. That mismatch is the sim-to-real gap.

The part that interests me most is not only visual realism. It is the whole transfer chain: how instructions become goals, how policies survive changing physics, how evaluation catches brittle behavior, and how a system decides when it should ask for more information instead of acting confidently in the wrong direction.

My current bet is that better instruction interfaces and better transfer protocols should be studied together. A robot that understands a task more clearly has a better chance of noticing when the real world has drifted away from the assumptions it learned under.
