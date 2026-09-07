# Reversi maintenance notes

When changing Reversi rules, keep move parsing strict, do not move rule authority into UI code, and preserve the automatic-pass invariant. Any rules change should add or update focused unit tests and should continue to pass the shared responsive/touch matrix in both English and Arabic.
