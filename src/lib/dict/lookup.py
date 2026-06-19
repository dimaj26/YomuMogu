import sys
import sqlite3
import json
import os

DB_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "jitendex", "jitendex", "jitendex.db")
)


def lookup(word):
    if not os.path.exists(DB_PATH):
        return {"error": f"Database file not found at {DB_PATH}"}

    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()

        current_word = word
        redirects = 0
        while redirects < 5:
            cur.execute("SELECT paraphrase FROM mdx WHERE entry = ?", (current_word,))
            row = cur.fetchone()
            if not row:
                break
            paraphrase = row[0]
            if paraphrase.startswith("@@@LINK="):
                current_word = paraphrase.replace("@@@LINK=", "").strip()
                redirects += 1
            else:
                conn.close()
                return {"word": word, "entry": current_word, "definition": paraphrase}
        conn.close()
        return {"word": word, "error": "Word not found"}

    except Exception as e:
        return {"word": word, "error": str(e)}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stdout.buffer.write(json.dumps({"error": "No word provided"}).encode("utf-8"))
        sys.exit(1)

    word_to_lookup = sys.argv[1]
    result = lookup(word_to_lookup)
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
