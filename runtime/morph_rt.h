/* morph_rt.h — the Morpheus native runtime.
   Inlined into every generated .cpp by morphc. Header-only, no dependencies
   beyond the C++ standard library. Values are dynamic (num / str / bool / list),
   matching the reference language. */
#include <string>
#include <vector>
#include <memory>
#include <cmath>
#include <algorithm>
#include <cctype>
#include <cstdio>
#include <functional>
#include <map>
#include <iostream>
#include <fstream>
#include <sstream>
#include <random>
#include <chrono>
#include <thread>
#include <cstdlib>
#include <stdexcept>
#ifdef _WIN32
#include <conio.h>
#else
#include <termios.h>
#include <unistd.h>
#include <fcntl.h>
#endif

struct Value;
using List = std::vector<Value>;
using Map = std::map<std::string, Value>;
using FnT = std::function<Value(std::vector<Value>)>;

struct Value {
  enum K { NUM, STR, BOOL, LIST, MAP, FUNC } k;
  double n; bool b; std::string s;
  std::shared_ptr<List> l;
  std::shared_ptr<Map> m;
  std::shared_ptr<FnT> fnv;
  Value(): k(NUM), n(0), b(false) {}
  Value(double x): k(NUM), n(x), b(false) {}
  Value(long long x): k(NUM), n((double)x), b(false) {}
  Value(unsigned long long x): k(NUM), n((double)x), b(false) {}
  Value(unsigned int x): k(NUM), n((double)x), b(false) {}
  Value(bool x): k(BOOL), n(0), b(x) {}
  Value(const char* x): k(STR), n(0), b(false), s(x) {}
  Value(const std::string& x): k(STR), n(0), b(false), s(x) {}
  Value(List x): k(LIST), n(0), b(false) { l = std::make_shared<List>(std::move(x)); }
  Value(std::shared_ptr<Map> mm): k(MAP), n(0), b(false), m(mm) {}
  Value(std::shared_ptr<FnT> fn): k(FUNC), n(0), b(false), fnv(fn) {}
};

struct RTError : std::runtime_error {
  std::string name;
  RTError(const std::string& nm): std::runtime_error(nm), name(nm) {}
};

inline bool rt_truthy(const Value& v) {
  if (v.k == Value::BOOL) return v.b;
  if (v.k == Value::NUM)  return v.n != 0;
  if (v.k == Value::STR)  return !v.s.empty();
  if (v.k == Value::MAP) return v.m && !v.m->empty();
  if (v.k == Value::FUNC) return true;
  return v.l && !v.l->empty();
}
inline double rt_num(const Value& v) {
  return v.k == Value::NUM ? v.n : (v.k == Value::BOOL ? (v.b ? 1.0 : 0.0) : 0.0);
}
inline std::string rt_str(const Value& v) {
  if (v.k == Value::STR) return v.s;
  if (v.k == Value::NUM) { double x = v.n; if (x == (long long)x && std::fabs(x) < 1e15) return std::to_string((long long)x); char b[64]; std::snprintf(b, sizeof b, "%.6f", x); std::string t(b); size_t dot = t.find('.'); if (dot != std::string::npos) { size_t last = t.find_last_not_of('0'); if (last == dot) last = dot - 1; t.erase(last + 1); } return t; }
  if (v.k == Value::BOOL) return v.b ? "true" : "false";
  if (v.k == Value::FUNC) return "<fn>";
  if (v.k == Value::MAP) { std::string out = "{"; size_t i = 0; for (auto& kv : *v.m) { if (i++) out += ", "; out += kv.first + ": " + rt_str(kv.second); } return out + "}"; }
  std::string out = "[";
  for (size_t i = 0; i < v.l->size(); ++i) { if (i) out += ", "; out += rt_str((*v.l)[i]); }
  return out + "]";
}

inline Value rt_neg(const Value& a) { return Value(-rt_num(a)); }
inline Value rt_not(const Value& a) { return Value(!rt_truthy(a)); }
inline Value rt_add(const Value& a, const Value& b) { return Value(rt_num(a) + rt_num(b)); }
inline Value rt_sub(const Value& a, const Value& b) { return Value(rt_num(a) - rt_num(b)); }
inline Value rt_mul(const Value& a, const Value& b) { return Value(rt_num(a) * rt_num(b)); }
inline Value rt_div(const Value& a, const Value& b) { double d = rt_num(b); if (d == 0) throw RTError("ZeroDivisionError"); return Value(rt_num(a) / d); }
inline Value rt_mod(const Value& a, const Value& b) { return Value(std::fmod(rt_num(a), rt_num(b))); }
inline Value rt_pow(const Value& a, const Value& b) { return Value(std::pow(rt_num(a), rt_num(b))); }
inline Value rt_cat(const Value& a, const Value& b) { return Value(rt_str(a) + rt_str(b)); }
inline Value rt_gt(const Value& a, const Value& b) { return Value(rt_num(a) > rt_num(b)); }
inline Value rt_lt(const Value& a, const Value& b) { return Value(rt_num(a) < rt_num(b)); }
inline Value rt_ge(const Value& a, const Value& b) { return Value(rt_num(a) >= rt_num(b)); }
inline Value rt_le(const Value& a, const Value& b) { return Value(rt_num(a) <= rt_num(b)); }

inline bool rt_eqv(const Value& a, const Value& b) {
  if ((a.k == Value::NUM || a.k == Value::BOOL) && (b.k == Value::NUM || b.k == Value::BOOL)) return rt_num(a) == rt_num(b);
  if (a.k == Value::STR && b.k == Value::STR) return a.s == b.s;
  if (a.k == Value::MAP || b.k == Value::MAP) return a.k == b.k && a.m == b.m;
  if (a.k == Value::FUNC || b.k == Value::FUNC) return a.k == b.k && a.fnv == b.fnv;
  if (a.k == Value::LIST && b.k == Value::LIST) {
    if (a.l->size() != b.l->size()) return false;
    for (size_t i = 0; i < a.l->size(); ++i) if (!rt_eqv((*a.l)[i], (*b.l)[i])) return false;
    return true;
  }
  return false;
}
inline Value rt_eq(const Value& a, const Value& b) { return Value(rt_eqv(a, b)); }
inline Value rt_ne(const Value& a, const Value& b) { return Value(!rt_eqv(a, b)); }
inline Value rt_and(const Value& a, const Value& b) { return rt_truthy(a) ? b : a; }
inline Value rt_or(const Value& a, const Value& b) { return rt_truthy(a) ? a : b; }

inline Value rt_noop(std::vector<Value>) { return Value(0.0); }
inline Value rt_print(std::vector<Value> xs) {
  for (size_t i = 0; i < xs.size(); ++i) { if (i) std::cout << ' '; std::cout << rt_str(xs[i]); }
  std::cout << "\n";
  return Value(0.0);
}
inline Value rt_len(const Value& v) { if (v.k == Value::STR) return Value((double)v.s.size()); if (v.k == Value::LIST) return Value((double)v.l->size()); if (v.k == Value::MAP) return Value((double)v.m->size()); return Value(0.0); }
inline Value rt_abs(const Value& a) { return Value(std::fabs(rt_num(a))); }
inline Value rt_sqrt(const Value& a) { return Value(std::sqrt(rt_num(a))); }
inline Value rt_sin(const Value& a) { return Value(std::sin(rt_num(a))); }
inline Value rt_cos(const Value& a) { return Value(std::cos(rt_num(a))); }
inline Value rt_exp(const Value& a) { return Value(std::exp(rt_num(a))); }
inline Value rt_round(std::vector<Value> a) {
  double x = rt_num(a[0]);
  if (a.size() > 1) { double p = std::pow(10.0, rt_num(a[1])); return Value(std::round(x * p) / p); }
  return Value((double)std::llround(x));
}
inline Value rt_min(std::vector<Value> a) { double m = rt_num(a[0]); for (auto& v : a) m = std::min(m, rt_num(v)); return Value(m); }
inline Value rt_max(std::vector<Value> a) { double m = rt_num(a[0]); for (auto& v : a) m = std::max(m, rt_num(v)); return Value(m); }
inline Value rt_ci(const Value& m, const Value& s, const Value& c) { return Value(rt_num(s) * (rt_truthy(c) || rt_num(c) != 0 ? rt_num(c) : 1.96)); }

inline std::mt19937_64& rt_rng() { static std::mt19937_64 g(std::random_device{}()); return g; }
inline Value rt_random_uniform(const Value& a, const Value& b) { std::uniform_real_distribution<double> d(rt_num(a), rt_num(b)); return Value(d(rt_rng())); }
inline Value rt_random_norm(const Value& m, const Value& s) { std::normal_distribution<double> d(rt_num(m), rt_num(s)); return Value(d(rt_rng())); }
inline Value rt_random_int(const Value& a, const Value& b) { std::uniform_int_distribution<long long> d((long long)rt_num(a), (long long)rt_num(b)); return Value((double)d(rt_rng())); }

inline Value rt_index(const Value& o, const Value& i) {
  long long idx = (long long)rt_num(i);
  if (o.k == Value::STR) { if (idx < 0 || idx >= (long long)o.s.size()) throw RTError("IndexError str idx " + std::to_string(idx) + " size " + std::to_string(o.s.size())); return Value(std::string(1, o.s[idx])); }
  if (o.k == Value::LIST) { if (idx < 0 || idx >= (long long)o.l->size()) throw RTError("IndexError list idx " + std::to_string(idx) + " size " + std::to_string(o.l->size())); return (*o.l)[idx]; }
  if (o.k == Value::MAP) { auto it = o.m->find(rt_str(i)); if (it == o.m->end()) throw RTError("KeyError: " + rt_str(i)); return it->second; }
  throw RTError("IndexError: not indexable (kind " + std::to_string((int)o.k) + ")");
}
inline Value rt_assert(std::vector<Value> a) { if (!(a.size() > 0 && rt_truthy(a[0]))) throw RTError("AssertionError" + (a.size() > 1 ? ": " + rt_str(a[1]) : "")); return Value(0.0); }
inline Value rt_call(Value f, std::vector<Value> a) { if (f.k == Value::FUNC && f.fnv) return (*f.fnv)(a); throw RTError("TypeError: not a function"); }
inline Value rt_set_index(Value o, Value i, Value v) { if (o.k == Value::MAP) { (*o.m)[rt_str(i)] = v; return v; } if (o.k == Value::LIST) { long long idx = (long long)rt_num(i); if (idx < 0 || idx >= (long long)o.l->size()) throw RTError("IndexError list set idx " + std::to_string(idx) + " size " + std::to_string(o.l->size())); (*o.l)[idx] = v; return v; } throw RTError("IndexError: not assignable"); }
inline Value rt_push(Value l, Value v) { l.l->push_back(v); return l; }
inline Value rt_pop(Value l) { if (l.l->empty()) return Value(0.0); Value v = l.l->back(); l.l->pop_back(); return v; }
inline Value rt_unshift(Value l, Value v) { l.l->insert(l.l->begin(), v); return l; }
inline Value rt_set(Value l, Value i, Value v) { (*l.l)[(long long)rt_num(i)] = v; return l; }
inline Value rt_remove_at(Value l, Value i) { l.l->erase(l.l->begin() + (long long)rt_num(i)); return l; }
inline Value rt_rand(Value l) { if (l.l->empty()) return Value(0.0); return (*l.l)[rt_rng()() % l.l->size()]; }

inline Value rt_clock() { using namespace std::chrono; return Value((double)duration_cast<milliseconds>(steady_clock::now().time_since_epoch()).count() / 1000.0); }
inline Value rt_read_file(const Value& p) { std::ifstream f(rt_str(p)); if (!f) throw RTError("FileNotFoundError"); std::stringstream ss; ss << f.rdbuf(); return Value(ss.str()); }
inline Value rt_write_file(const Value& p, const Value& t) { std::ofstream f(rt_str(p)); f << rt_str(t); return Value(0.0); }

// ---- memory: a scoped bump-region (arena). Everything allocated inside
//      `arena { ... }` is reclaimed at once when the block exits. ----
struct RtArenaStore { std::vector<std::shared_ptr<List>> lists; };
inline std::vector<RtArenaStore*>& rt_arena_stack() { static std::vector<RtArenaStore*> s; return s; }
struct RtArena {
  RtArenaStore store;
  RtArena() { rt_arena_stack().push_back(&store); }
  ~RtArena() { rt_arena_stack().pop_back(); }
  RtArena(const RtArena&) = delete;
  RtArena& operator=(const RtArena&) = delete;
};
inline Value rt_arena_list(List x) {
  Value v(std::move(x));
  if (!rt_arena_stack().empty()) rt_arena_stack().back()->lists.push_back(v.l);
  return v;
}
inline Value rt_arena_bytes() {
  size_t b = 0;
  for (auto s : rt_arena_stack()) for (auto& p : s->lists) if (p) b += p->size() * sizeof(Value);
  return Value((double)b);
}

inline Value rt_args(int argc, char** argv) { List l; for (int i = 1; i < argc; ++i) l.push_back(Value(std::string(argv[i]))); return Value(l); }

// ---------- standard library (string / list / map / conversion) ----------
inline Value rt_type(std::vector<Value> a) { const Value& x = a[0];   return Value(x.k == Value::NUM ? "number" : x.k == Value::STR ? "string" : x.k == Value::BOOL ? "boolean" : x.k == Value::FUNC ? "function" : x.k == Value::MAP ? "map" : "list"); }
inline Value rt_toint(std::vector<Value> a) { return Value((double)(long long)rt_num(a[0])); }
inline Value rt_tofloat(std::vector<Value> a) { return Value(rt_num(a[0])); }
inline Value rt_tostr(std::vector<Value> a) { return Value(rt_str(a[0])); }
inline Value rt_floor(std::vector<Value> a) { return Value(std::floor(rt_num(a[0]))); }
inline Value rt_ceil(std::vector<Value> a) { return Value(std::ceil(rt_num(a[0]))); }
inline Value rt_tan(std::vector<Value> a) { return Value(std::tan(rt_num(a[0]))); }
inline Value rt_log(std::vector<Value> a) { return Value(std::log(rt_num(a[0]))); }
inline Value rt_upper(std::vector<Value> a) { std::string t = rt_str(a[0]); for (auto& c : t) c = (char)std::toupper((unsigned char)c); return Value(t); }
inline Value rt_lower(std::vector<Value> a) { std::string t = rt_str(a[0]); for (auto& c : t) c = (char)std::tolower((unsigned char)c); return Value(t); }
inline Value rt_trim(std::vector<Value> a) { std::string t = rt_str(a[0]); size_t i0 = t.find_first_not_of(" \t\r\n"); if (i0 == std::string::npos) return Value(std::string("")); size_t i1 = t.find_last_not_of(" \t\r\n"); return Value(t.substr(i0, i1 - i0 + 1)); }
inline Value rt_split(std::vector<Value> a) { std::string s = rt_str(a[0]); std::string d = a.size() > 1 ? rt_str(a[1]) : ""; List out; if (d.empty()) { for (char c : s) out.push_back(Value(std::string(1, c))); return Value(out); } size_t pos = 0, n; while ((n = s.find(d, pos)) != std::string::npos) { out.push_back(Value(s.substr(pos, n - pos))); pos = n + d.size(); } out.push_back(Value(s.substr(pos))); return Value(out); }
inline Value rt_join(std::vector<Value> a) { std::string d = a.size() > 1 ? rt_str(a[1]) : ","; std::string s; for (size_t i = 0; i < a[0].l->size(); ++i) { if (i) s += d; s += rt_str((*a[0].l)[i]); } return Value(s); }
inline Value rt_contains(std::vector<Value> a) { if (a[0].k == Value::LIST) { for (auto& v : *a[0].l) if (rt_eqv(v, a[1])) return Value(true); return Value(false); } if (a[0].k == Value::MAP) return Value(a[0].m->count(rt_str(a[1])) > 0); return Value(rt_str(a[0]).find(rt_str(a[1])) != std::string::npos); }
inline Value rt_index_of(std::vector<Value> a) { if (a[0].k == Value::LIST) { for (size_t i = 0; i < a[0].l->size(); ++i) if (rt_eqv((*a[0].l)[i], a[1])) return Value((double)i); return Value(-1.0); } auto p = rt_str(a[0]).find(rt_str(a[1])); return Value(p == std::string::npos ? -1.0 : (double)p); }
inline Value rt_substr(std::vector<Value> a) { std::string t = rt_str(a[0]); long long st = (long long)rt_num(a[1]); long long en = a.size() > 2 ? (long long)rt_num(a[2]) : (long long)t.size(); if (st < 0) st = 0; if (en > (long long)t.size()) en = (long long)t.size(); if (en < st) return Value(std::string("")); return Value(t.substr(st, en - st)); }
inline Value rt_replace(std::vector<Value> a) { std::string s = rt_str(a[0]), from = rt_str(a[1]), to = rt_str(a[2]); if (from.empty()) return Value(s); size_t p = 0; while ((p = s.find(from, p)) != std::string::npos) { s.replace(p, from.size(), to); p += to.size(); } return Value(s); }
inline Value rt_starts_with(std::vector<Value> a) { std::string s = rt_str(a[0]), p = rt_str(a[1]); return Value(s.size() >= p.size() && s.compare(0, p.size(), p) == 0); }
inline Value rt_ends_with(std::vector<Value> a) { std::string s = rt_str(a[0]), p = rt_str(a[1]); return Value(s.size() >= p.size() && s.compare(s.size() - p.size(), p.size(), p) == 0); }
inline Value rt_repeat(std::vector<Value> a) { std::string s; long long n = (long long)rt_num(a[1]); if (n < 0) n = 0; for (long long i = 0; i < n; ++i) s += rt_str(a[0]); return Value(s); }
inline Value rt_shift(std::vector<Value> a) { if (a[0].l->empty()) return Value(0.0); Value v = a[0].l->front(); a[0].l->erase(a[0].l->begin()); return v; }
inline Value rt_insert(std::vector<Value> a) { a[0].l->insert(a[0].l->begin() + (long long)rt_num(a[1]), a[2]); return a[0]; }
inline Value rt_remove(std::vector<Value> a) { auto& L = *a[0].l; for (size_t i = 0; i < L.size(); ++i) if (rt_eqv(L[i], a[1])) { L.erase(L.begin() + i); break; } return a[0]; }
inline Value rt_reverse(std::vector<Value> a) { if (a[0].k == Value::STR) { std::string s = rt_str(a[0]); std::reverse(s.begin(), s.end()); return Value(s); } List l = *a[0].l; std::reverse(l.begin(), l.end()); return Value(l); }
inline Value rt_sort(std::vector<Value> a) { List l = *a[0].l; std::stable_sort(l.begin(), l.end(), [](const Value& x, const Value& y) { if (x.k == Value::NUM && y.k == Value::NUM) return x.n < y.n; return rt_str(x) < rt_str(y); }); return Value(l); }
inline Value rt_sum(std::vector<Value> a) { double s = 0; for (auto& v : *a[0].l) s += rt_num(v); return Value(s); }
inline Value rt_min_of(std::vector<Value> a) { double m = rt_num((*a[0].l)[0]); for (auto& v : *a[0].l) m = std::min(m, rt_num(v)); return Value(m); }
inline Value rt_max_of(std::vector<Value> a) { double m = rt_num((*a[0].l)[0]); for (auto& v : *a[0].l) m = std::max(m, rt_num(v)); return Value(m); }
inline Value rt_map(std::vector<Value> a) { auto m = std::make_shared<Map>(); for (size_t i = 0; i + 1 < a.size(); i += 2) (*m)[rt_str(a[i])] = a[i + 1]; return Value(m); }
inline Value rt_keys(std::vector<Value> a) { List l; for (auto& kv : *a[0].m) l.push_back(Value(kv.first)); return Value(l); }
inline Value rt_values(std::vector<Value> a) { List l; for (auto& kv : *a[0].m) l.push_back(kv.second); return Value(l); }
inline Value rt_has(std::vector<Value> a) { return Value(a[0].m->count(rt_str(a[1])) > 0); }
inline Value rt_get(std::vector<Value> a) { auto it = a[0].m->find(rt_str(a[1])); if (it != a[0].m->end()) return it->second; return a.size() > 2 ? a[2] : Value(0.0); }
inline Value rt_put(std::vector<Value> a) { (*a[0].m)[rt_str(a[1])] = a[2]; return a[0]; }
inline Value rt_del(std::vector<Value> a) { a[0].m->erase(rt_str(a[1])); return a[0]; }
inline Value rt_range(std::vector<Value> a) { long long lo = a.size() > 1 ? (long long)rt_num(a[0]) : 0; long long hi = a.size() > 1 ? (long long)rt_num(a[1]) : (long long)rt_num(a[0]); long long st = a.size() > 2 ? (long long)rt_num(a[2]) : 1; if (st == 0) st = 1; List l; if (st > 0) for (long long i = lo; i < hi; i += st) l.push_back(Value((double)i)); else for (long long i = lo; i > hi; i += st) l.push_back(Value((double)i)); return Value(l); }

// ---- host: screen, clock, keyboard (so apps/games run natively) ----
inline Value rt_clear() { std::cout << "\x1b[2J\x1b[H" << std::flush; return Value(0.0); }
inline Value rt_sleep(const Value& ms) { std::this_thread::sleep_for(std::chrono::milliseconds((long long)rt_num(ms))); return Value(0.0); }
inline Value rt_key() {
#ifdef _WIN32
  if (_kbhit()) {
    int c = _getch();
    if (c == 0 || c == 224) { int c2 = _getch(); if (c2 == 72) return Value("w"); if (c2 == 80) return Value("s"); if (c2 == 75) return Value("a"); if (c2 == 77) return Value("d"); return Value(""); }
    if (c == 3) std::exit(0);
    char ch = (char)c; if (ch >= 'A' && ch <= 'Z') ch = (char)(ch - 'A' + 'a');
    if (std::string("wasdgq").find(ch) != std::string::npos) return Value(std::string(1, ch));
  }
  return Value("");
#else
  static bool init = false; static termios oldt;
  if (!init) { tcgetattr(0, &oldt); termios t = oldt; t.c_lflag &= ~(ICANON | ECHO); t.c_cc[VMIN] = 0; t.c_cc[VTIME] = 0; tcsetattr(0, TCSANOW, &t); fcntl(0, F_SETFL, fcntl(0, F_GETFL) | O_NONBLOCK); init = true; }
  unsigned char ch; if (read(0, &ch, 1) == 1) { if (ch == 3) std::exit(0); if (ch >= 'A' && ch <= 'Z') ch = (char)(ch - 'A' + 'a'); if (std::string("wasdgq").find((char)ch) != std::string::npos) return Value(std::string(1, (char)ch)); }
  return Value("");
#endif
}
