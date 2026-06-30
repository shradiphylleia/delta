# delta
exploring CDN like resilience for composed APIs, where the response is not cached or failed as one object, but planned dependency by dependency under freshness, criticality and failure constraints.

<u> **Example:**</u>
| Service         | Requirement | Status   | Cache       | Action |
|----------------|-------------|----------|-------------|--------|
| Pricing        | REQUIRED    | DOWN     | no cache    | **FAIL** |
| Inventory      | REQUIRED    | DEGRADED | fresh cache | **CACHE** |
| Reviews        | OPTIONAL    | DOWN     | stale cache | **STALE** |
| Recommendations| OPTIONAL    | DOWN     | no cache    | **OMIT** |

the composed resp gets: Product API -> Fail (pricing is required and has no fallback)

# Setting up locally:

Configure with hugging face: (optional, required only for nautral lang based queries)
Run the following command and configure your api token and model of choice(personally used: Qwen/Qwen2.5-7B-Instruct )

``` bash
echo -e "HF_API_TOKEN= \n HF_MODEL=" >.test
```
Backend
``` bash
cd backend
go run ./cmd/api
```

Frontend (run in another terminal):
```bash
cd frontend
npm run dev
```
delta will be available here: http://127.0.0.1:5173/

# look & feel


# spark note:
https://www.jeet.world/practical-cdn-caching-for-developers/ by  Jitendra Agrawal

i read this blog about the use of cdn and how they can help optimize user experience. During my time as an intern with Oracle(this project is in no way shape or form realted to them), i was working with apis and systems where service decomposition was the norm so the concept of always online made me think of services which interact and dependent on multiple others for their response. 

how could this idea translate in systems built around many microservices for example where a response is composed of multiple downstream dependencies? 
could cdn help in providing resilience there or service composition would become the limiting factor?

delta is an exploration on this idea. 

# Understanding at large:
The core idea of the blog was CDNS improve user experience by caching, reducing origin load & sometimes serving stale content when the origin is down. Thus, the user is kept away from seeing transient origin failures.

Well a CDN can cache one whole respone well when the response is of that nautre i.e. stable and cacheable (more often than not i believe it has to do with the business logic at hand and where the value it provides sits in that pov)

and with the time i have spent at enterprises working across with their data systems, they are not serving one clean object coming from one source. the repsonses served are composed at request time from many services (like during my time with OPERA team @ Oracle, it was about reservations and the linked components you would find to a reservation speaking on a surface level)

this is where service composition would become a limiting factor to my uninterrupted user experience.

So delta here as a table-stakes idea has to for each part of this composed response think should I call live, use cache, serve stale, omit or fail?

## it will answer what would be equivalent of CDn style resilience for dynamically composed API response.
In CDN based architecture, the unit of decision might usually be the full asset or full response.
In Delta, the unit of decision is each dependency inside the response.


# nomenclature:
named after geographical features: delta ( class 10 ICSE Geography callback lol)
if unaware or need a refresher on delta this wiki page should help: https://en.wikipedia.org/wiki/River_delta

A river delta forms where many flows slow down, branch and deposit sediment before becoming part of something larger.API responses behave in a somewhat similar way.A single response is often composed of many downstream services, each carrying different needs in terms of freshness(that would be the last time db would be hit to get a value), failure modes, latency and the business importance it holds. No two APIs in a system working maybe on the same module have the same business problem they work towards, it could be that they work on achieving a greater point but mostly they have a relevance which differentiates them as an individual use case in a bigger picture. the point of exploration is can i make what is the picture without having a few pieces in the picture??

delta explores what happens at that meeting point.

instead of treating an API response as all-or-nothing, delta asks which parts should be live, cached, stale, omitted or failed when conditions change. The project is about making response composition intentional under partial failure, much like a river delta is shaped by the many streams and sediments that flow into it.

## shortcomings
console level does not log the runs at the moment poses difficulty esp with hugging face wiring and not wired status check(currently validation is via frontend) //open to collab- open a pr or get in touch: shradulsha@gmail.com
maybe could become a plug (would need to see how to infer incoming data or information stream on microservice setup)[ambitious]