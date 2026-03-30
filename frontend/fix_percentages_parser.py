import re, json
import wordninja

with open('data/percentages_questions_raw.txt','r',encoding='utf-8') as f:
    raw = f.read()

# Answer key
ak = re.search(r'Answer Key\s*:-\s*(.*)', raw, re.S)
if not ak:
    raise SystemError('Answer key not found')
key_text = ak.group(1).strip()
answers = {int(m.group(1)): m.group(2).lower() for m in re.finditer(r'(\d+)\.\s*\(?([a-dA-D])\)?', key_text)}

questions_section = raw[:ak.start()]
blocks = re.split(r'(?=Q\.\d+\.)', questions_section)
if blocks and not blocks[0].strip().startswith('Q.'):
    blocks = blocks[1:]


def normalize_text(text):
    text = text.replace('\xa0',' ')
    text = text.strip()
    text = text.replace('%', ' %')
    text = re.sub(r'\s*([.,?;:()])\s*', r'\1 ', text)
    text = re.sub(r'\s+', ' ', text)
    # split into tokens
    toks=[]
    for t in text.split(' '):
        if re.fullmatch(r'[.,?;:()]+', t):
            toks.append(t)
            continue
        core = t
        # handle apostrophes separately
        if "'" in core or "’" in core:
            p = re.split(r"('|’)", core)
            new=''
            for piece in p:
                if piece in ("'", "’"):
                    new += piece
                else:
                    if len(piece)>6 and piece.isalpha():
                        new += ' '.join(wordninja.split(piece.lower()))
                    else:
                        new += piece
            toks.append(new)
            continue
        # broad token segmentation
        clean_alpha = re.sub(r'[^A-Za-z]', '', core)
        if len(clean_alpha) > 6 and clean_alpha.isalpha():
            seg = wordninja.split(clean_alpha.lower())
            if len(seg) > 1:
                # preserve case of first char
                if core and core[0].isupper():
                    seg[0] = seg[0].capitalize()
                toks.append(' '.join(seg) + ('' if core.endswith('%') else ''))
                continue
        toks.append(core)

    out = ' '.join(toks)
    out = out.replace(' %', '%')
    out = out.replace('kgof', 'kg of').replace('ofrice', 'of rice').replace('ofwheat','of wheat')
    out = out.replace('monthfor','month for').replace('wheatcombined','wheat combined')
    out = out.replace('votespolledand','votes polled and').replace('votescastwas','votes cast was')
    out = re.sub(r'(\d+)\s+\.(\d+)', r'\1.\2', out)
    out = re.sub(r'(\d+),(\s*\d+)', lambda m: m.group(1)+','+m.group(2).strip(), out)
    out = re.sub(r'\s+', ' ', out).strip()
    return out

question_objs=[]
for block in blocks:
    block = block.strip()
    if not block: continue
    m = re.match(r'Q\.(\d+)\.(.*)', block, re.S)
    if not m: continue
    qid = int(m.group(1))
    body = m.group(2).strip()
    opt = re.search(r'\(a\)\s*(.*?)\s*\(b\)\s*(.*?)\s*\(c\)\s*(.*?)\s*\(d\)\s*(.*)', body, re.I|re.S)
    if not opt:
        opt = re.search(r'a\)\s*(.*?)\s*b\)\s*(.*?)\s*c\)\s*(.*?)\s*d\)\s*(.*)', body, re.I|re.S)
    if not opt:
        print('failed options', qid)
        continue
    opt_a = normalize_text(opt.group(1).strip())
    opt_b = normalize_text(opt.group(2).strip())
    opt_c = normalize_text(opt.group(3).strip())
    opt_d = normalize_text(opt.group(4).strip())
    q_text = normalize_text(body[:opt.start()].strip())
    exam=''
    q_lines = [ln.strip() for ln in q_text.split('\n') if ln.strip()]
    if q_lines:
        last = q_lines[-1]
        if re.search(r'(SSC|CHSL|CGL|CPO|Matriculation|Tier|Shift|202\d)', last, re.I):
            exam = last
            q_text = ' '.join(q_lines[:-1]).strip()
    ans_letter = answers.get(qid,'a')
    question_objs.append({
        'id': qid,
        'concept': 'Percentages',
        'formula': '',
        'question': q_text,
        'options': [opt_a, opt_b, opt_c, opt_d],
        'correctAnswer': {'a':0,'b':1,'c':2,'d':3}.get(ans_letter.lower(),0),
        'answer': ans_letter.lower(),
        'difficulty':'medium','estimatedTime':60,'year':'','exam':exam
    })

json.dump(question_objs, open('data/percentages_questions.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)
print('saved', len(question_objs))
print('sample1', question_objs[0]['question'])
print('sample2', question_objs[1]['question'])
