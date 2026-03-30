import re, json
import wordninja

with open('data/percentages_questions_raw.txt','r',encoding='utf-8') as f:
    raw = f.read()

# remove bidi formatting marks
raw = raw.replace('\u202d','').replace('\u202c','')

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
    text = text.replace('\xa0', ' ').replace('\n', ' ')
    # ensure numbers and letters do not collapse (e.g., 'riceand8kg' => 'riceand 8kg')
    text = re.sub(r'(?<=[A-Za-z])(?=\d)', ' ', text)
    text = re.sub(r'(?<=\d)(?=[A-Za-z])', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    text = text.replace('%', ' % ')
    text = re.sub(r'\s*([,.;:?()])\s*', r'\1 ', text)
    text = re.sub(r'\s+', ' ', text).strip()

    tokens=[]
    for token in text.split(' '):
        if re.fullmatch(r'[.,?;:()]+', token):
            tokens.append(token)
            continue
        core=token
        # split words with no spaces using wordninja
        clean = re.sub(r'[^A-Za-z]', '', core)
        if len(clean) > 5 and clean.isalpha():
            seg = wordninja.split(clean.lower())
            if len(seg) > 1:
                if core[0].isupper():
                    seg[0] = seg[0].capitalize()
                token = ' '.join(seg)
        tokens.append(token)

    out = ' '.join(tokens)
    out = out.replace(' %', '%')
    # remove degraded boilerplate/spam that appears mid-question
    out = re.sub(r'www\.?\s*s\s*s\s*c\s*c\s*g\s*l\s*\.?\s*pinnacle\s*com.*?(?=\d+\s*\(|$)', '', out, flags=re.I)
    out = re.sub(r'Pinnacle\s*Day\s*:\s*\d+\s*th\s*-\s*\d+\s*th\s*Percentage', '', out, flags=re.I)

    # manual fixes
    fixes = {
        'kgof':'kg of', 'ofrice':'of rice', 'ofwheat':'of wheat',
        'wheatcombined':'wheat combined', 'votespolled':'votes polled',
        'votescast':'votes cast', 'validvotes':'valid votes', 'infavourof':'in favour of',
        'monthlysalary':'monthly salary', 'percentageof':'percentage of', 'increasedby':'increased by',
        'decreasedby':'decreased by'
    }
    for k,v in fixes.items():
        out=out.replace(k,v).replace(k.capitalize(),v.capitalize())
    out = re.sub(r'(\d+)\s*\.\s*(\d+)', r'\1.\2', out)
    out = re.sub(r'(\d+),\s*(\d+)', r'\1,\2', out)
    out = re.sub(r'\s+', ' ', out).strip()
    return out

question_objs=[]
for block in blocks:
    block = block.strip()
    if not block:
        continue
    m = re.match(r'Q\.(\d+)\.(.*)', block, re.S)
    if not m:
        continue
    qid = int(m.group(1))
    body = m.group(2).strip()
    opt = re.search(r'\(a\)\s*(.*?)\s*\(b\)\s*(.*?)\s*\(c\)\s*(.*?)\s*\(d\)\s*(.*)', body, re.I|re.S)
    if not opt:
        opt = re.search(r'a\)\s*(.*?)\s*b\)\s*(.*?)\s*c\)\s*(.*?)\s*d\)\s*(.*)', body, re.I|re.S)
    if not opt:
        continue
    opt_a = normalize_text(opt.group(1))
    opt_b = normalize_text(opt.group(2))
    opt_c = normalize_text(opt.group(3))
    opt_d = normalize_text(opt.group(4))

    question_text = normalize_text(body[:opt.start()])

    # detect exam from tokens if present
    exam = ''
    exam_match = re.search(r'(SSC\b.*|Matriculation\b.*|CGL\b.*|CHSL\b.*|CPO\b.*|Tier\b.*?Shift\b.*?)(?=$|\s)', question_text, re.I)
    if exam_match and exam_match.start()>0:
        exam = question_text[exam_match.start():].strip()
        question_text = question_text[:exam_match.start()].strip()

    letter = answers.get(qid,'a')
    question_objs.append({
        'id': qid,
        'concept':'Percentages', 'formula':'', 'question':question_text,
        'options':[opt_a,opt_b,opt_c,opt_d], 'correctAnswer':{'a':0,'b':1,'c':2,'d':3}.get(letter.lower(),0),
        'answer': letter.lower(), 'difficulty':'medium', 'estimatedTime':60, 'year':'', 'exam': exam
    })

json.dump(question_objs, open('data/percentages_questions.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)
print('saved', len(question_objs))
