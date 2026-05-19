---
title: "A Cooperative Coevolution Algorithm with a Heterogeneous-Island-Based Hyper-Heuristic for Cloud-Edge-Device Collaborative Scheduling"
authors:
  - "Jianheng Hu"
  - "Yuanjun Laili"
  - "Lei Ren"
status: "under review"
venue: "Target: Robotics and Computer-Integrated Manufacturing / Journal of Manufacturing Systems"
year: 2026
updatedDate: 2026-05-17
thread: "distributed-cooperation"
audience: "research collaborators and paper readers"
code: "https://github.com/dreamkeeperhu/CCHIHH_Final"
problem: "Cloud-edge-device collaborative scheduling needs to coordinate offloading, sequencing, and assignment while resource conditions and communication costs change."
method: "CCHIHH uses cooperative coevolution, heterogeneous islands, and contextual bandit learners to adapt search behavior for different decision blocks."
contribution:
  - "Treats offloading, sequencing, and assignment as coupled but separable decision blocks."
  - "Uses block-specific contextual bandit learners inside a heterogeneous-island coevolution framework."
  - "Adds a stability gate so productive search trajectories are preserved under changing resource conditions."
limitations:
  - "The manuscript PDF is intentionally private until publication or preprint release."
  - "The current public artifact is a status page and research code trace, not a packaged benchmark suite."
  - "The domain is scheduling rather than robotics, so its connection to embodied intelligence is methodological."
reviewNote: "This page is maintained as a reviewer-facing archive: status, artifact links, and clarifications can be updated without changing the rest of the site."
evidence:
  - "Experiments cover instances from 50 to 500 tasks with up to 800 devices."
  - "The paper compares against evolutionary baselines and studies resource degradation and communication inflation."
nextStep: "Keep the public page ready for paper status updates, reviewer-facing clarifications, reproducibility notes, and a future PDF release after publication or preprint clearance."
relatedProjects:
  - "/projects/cchihh-scheduling"
relatedNotes:
  - "/notes/sim-to-real-transfer-gap"
relatedLibrary:
  - "/library"
artifacts:
  - label: "Implementation repository"
    type: "code"
    href: "https://github.com/dreamkeeperhu/CCHIHH_Final"
    description: "Research code and experiment workspace connected to the paper."
    status: "available"
  - label: "Project trace"
    type: "project"
    href: "/projects/cchihh-scheduling"
    description: "Public project page summarizing the implementation and experiment direction."
    status: "available"
bibtex: |
  @article{hu2026cchihh,
    title = {A Cooperative Coevolution Algorithm with a Heterogeneous-Island-Based Hyper-Heuristic for Cloud-Edge-Device Collaborative Scheduling},
    author = {Hu, Jianheng and Laili, Yuanjun and Ren, Lei},
    year = {2026},
    note = {Under review}
  }
tags:
  - "Cloud-Edge-Device"
  - "Cooperative coevolution"
  - "Contextual bandits"
  - "Scheduling"
abstract: "In distributed manufacturing, cloud servers, edge servers, and shop-floor devices are coordinated to jointly execute computational services and production operations. Scheduling such systems requires three tightly coupled decisions: task offloading, operation sequencing, and device assignment. This work develops CCHIHH, a structure-aligned framework that decomposes the decision space into semantically coherent blocks, assigns each block an independent adaptive learner, maintains parallel search trajectories through heterogeneous islands, and safeguards productive convergence with a stability gate. Experiments on instances ranging from 50 to 500 tasks with up to 800 devices show the advantage of block-specific adaptation, stronger performance against evolutionary baselines, and slower performance deterioration under resource degradation and communication inflation."
---

This entry tracks the public status of the CCHIHH paper and its related implementation notes.
