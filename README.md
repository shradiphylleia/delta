# delta
the idea of how cdn's could work in a environment where  

# spark note:
https://www.jeet.world/practical-cdn-caching-for-developers/ by  Jitendra Agrawal

i read this blog about the use of cdn and how they can help optimize user experience. During my time as an intern with Oracle, i was working with apis and systems where service decomposition was the norm so the concept of always online made me think of services which interact and dependent on multiple others for their response. 

how could this idea translate in systems built around many microservices for example where a response is composed of multiple downstream dependencies? 
could cdn help in providing resilience there or service composition would become the limiting factor?

delta is an exploration on this idea. 

# nomenclature:
named after geographical features: delta ( class 10 ICSE Geography callback lol)
if unaware or need a refresher on delta this wiki page should help: https://en.wikipedia.org/wiki/River_delta

A river delta forms where many flows slow down, branch and deposit sediment before becoming part of something larger.API responses behave in a somewhat similar way.A single response is often composed of many downstream services, each carrying different needs in terms of freshness(that would be the last time db would be hit to get a value), failure modes, latency and the business importance it holds. No two APIs in a system working maybe on the same module have the same business problem they work towards, it could be that they work on achieving a greater point but mostly they have a relevance which differentiates them as an individual use case in a bigger picture. the point of exploration is can i make what is the picture without having a few pieces in the picture??

delta explores what happens at that meeting point.

instead of treating an API response as all-or-nothing, delta asks which parts should be live, cached, stale, omitted or failed when conditions change. The project is about making response composition intentional under partial failure, much like a river delta is shaped by the many streams and sediments that flow into it.
