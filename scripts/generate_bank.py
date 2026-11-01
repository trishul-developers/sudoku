"""Generate and rate UNIQUE Sudoku puzzles offline for the prepackaged game bank.
Runtime merely applies row/column/digit permutations, avoiding expensive mobile CPU work.
"""
import json, random, sys, time
from pathlib import Path

rng = random.Random(13042026)
PEERS = [set() for _ in range(81)]
UNITS = []
for k in range(9):
    UNITS += [[k*9+j for j in range(9)], [j*9+k for j in range(9)]]
for br in range(3):
    for bc in range(3):
        UNITS.append([(br*3+y)*9+bc*3+x for y in range(3) for x in range(3)])
for u in UNITS:
    for i in u: PEERS[i].update(j for j in u if i != j)

def options(board, i):
    taken = {board[j] for j in PEERS[i]}
    return [d for d in range(1, 10) if d not in taken]

def count(board, cutoff=2):
    board = board[:]; found = 0
    def dfs():
        nonlocal found
        if found >= cutoff: return
        best_i, best = -1, None
        for i, v in enumerate(board):
            if v: continue
            opts = options(board, i)
            if not opts: return
            if best is None or len(opts) < len(best): best_i, best = i, opts
            if len(opts) == 1: break
        if best_i == -1:
            found += 1
            return
        for v in best:
            board[best_i] = v
            dfs()
            board[best_i] = 0
            if found >= cutoff: return
    dfs()
    return found

def solve_grade(board):
    work = board[:]; hidden = 0; naked = 0
    while 0 in work:
        single = next(((i, options(work, i)[0]) for i,v in enumerate(work) if v == 0 and len(options(work, i)) == 1), None)
        if single:
            work[single[0]] = single[1]; naked += 1; continue
        hidden_single = None
        for u in UNITS:
            for n in range(1,10):
                if n in [work[i] for i in u]: continue
                places = [i for i in u if not work[i] and n in options(work,i)]
                if len(places) == 1:
                    hidden_single = (places[0], n); break
            if hidden_single: break
        if hidden_single:
            work[hidden_single[0]] = hidden_single[1]; hidden += 1; continue
        break
    unsolved = work.count(0)
    # Count number of search guesses / expansions, a rough lower-bound complexity marker.
    nodes = 0
    def dfs(b):
        nonlocal nodes
        if nodes > 200000: return False
        best_i, best = -1, None
        for i,v in enumerate(b):
            if v: continue
            opts = options(b,i)
            if not opts: return False
            if best is None or len(opts)<len(best): best_i, best=i,opts
        if best_i == -1: return True
        if len(best)>1: nodes += 1
        for n in best:
            b[best_i] = n
            if dfs(b): return True
        b[best_i]=0
        return False
    dfs(work[:]); return hidden, unsolved, nodes

def solution():
    base = [[(r*3+r//3+c)%9+1 for c in range(9)] for r in range(9)]
    groups = rng.sample(range(3),3)
    rows = [3*g+i for g in groups for i in rng.sample(range(3),3)]
    groups = rng.sample(range(3),3)
    cols = [3*g+i for g in groups for i in rng.sample(range(3),3)]
    digits = rng.sample(range(1,10),9)
    return [digits[base[r][c]-1] for r in rows for c in cols]

def carve(sol, target):
    board = sol[:]
    indices = list(range(81)); rng.shuffle(indices)
    for i in indices:
        if board.count(0) >= 81-target: break
        old = board[i]; board[i]=0
        if count(board) != 1: board[i]=old
    return board

def matches(diff, clues, hidden, unsolved, nodes):
    if diff=='easy': return clues >= 43 and unsolved==0 and hidden <= 6
    if diff=='medium': return 36 <= clues <= 41 and unsolved == 0 and hidden >= 2
    if diff=='hard': return 30 <= clues <= 36 and (unsolved >= 3 or hidden >= 9)
    if diff=='expert': return 24 <= clues <= 30 and unsolved >= 12 and nodes >= 2

if __name__ == '__main__':
    bank = {k:[] for k in ('easy','medium','hard','expert')}
    targets = {'easy':45,'medium':38,'hard':32,'expert':26}
    started=time.time(); attempts={k:0 for k in bank}
    for diff in bank:
        for trial in range(16000):
            if len(bank[diff]) == 8: break
            attempts[diff]+=1
            s=solution(); p=carve(s,targets[diff]); clues=81-p.count(0)
            h,u,n=solve_grade(p)
            if matches(diff,clues,h,u,n):
                bank[diff].append({'puzzle':''.join(map(str,p)), 'solution':''.join(map(str,s))})
                print(diff,len(bank[diff]), 'clues',clues,'hidden',h,'unsolved',u,'nodes',n,'elapsed',round(time.time()-started,1),flush=True)
        if not bank[diff]: print('No puzzles for',diff,file=sys.stderr); sys.exit(1)
    path = Path(__file__).resolve().parent.parent / 'www/js/puzzles.js'
    path.write_text('/* Offline original unique puzzle bank, rated during generation. */\nwindow.SUDOKU_PUZZLES = '+json.dumps(bank,separators=(',',':'))+';\n')
    print('done', {k:len(v) for k,v in bank.items()}, attempts, round(time.time()-started,1))
