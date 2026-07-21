# SkyRing Release Network Matrix

The deterministic `pnpm test:network` lane runs the same 180-tick predicted flight under
five ordered-link profiles. One tick is 16.67 ms at the production 60 Hz simulation rate.

| Profile                 | Uplink                          | Downlink                        | Required behavior                                              |
| ----------------------- | ------------------------------- | ------------------------------- | -------------------------------------------------------------- |
| Local                   | no added delay                  | no added delay                  | Immediate prediction and exact final convergence               |
| Representative internet | 100 ms ±17 ms                   | 100 ms ±17 ms                   | Responsive local motion; retained input acknowledged once      |
| High jitter             | 133 ms ±100 ms                  | 133 ms ±100 ms                  | Ordered delivery, finite prediction, bounded queues            |
| Short input stall       | 100 ms ±50 ms plus 300 ms pause | 100 ms ±50 ms                   | Server reuses last intent; tail ack drains without duplication |
| Snapshot pause          | 100 ms ±50 ms                   | 100 ms ±50 ms plus 417 ms pause | Local prediction continues; correction converges to authority  |

Every profile enforces the shared 240-input cap, a queued-downlink ceiling of 50,
sub-250-world-unit raw correction error, finite state, visible local travel, final `ackSeq`
180, an empty retained-input buffer, and sub-millimeter rendered convergence after
smoothing.

Abrupt disconnect behavior is exercised over real WebSockets by
`tests/integration/matchmaking.test.ts`: the live survivor receives the authoritative win,
countdown disconnect is no-contest, matches/queues are removed, and server shutdown closes
remaining sockets. Browser and real-internet disconnect recovery beyond v1's explicit
no-reconnection ruling is not claimed.
