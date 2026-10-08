/* morph_rt.h — the Morpheus native runtime.
   Inlined into every generated .cpp by morphc. Header-only, no dependencies
   beyond the C++ standard library. Values are dynamic (num / str / bool / list),
   matching the reference language. */
#include <string>
#include <vector>
#include <memory>
#include <cmath>
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

struct Value {
  enum K { NUM, STR, BOOL, LIST } k;
  double n; bool b; std::string s; std::shared_ptr<List> l;
  Value(): k(NUM), n(0), b(false) {}
  Value(double x): k(NUM), n(x), b(false) {}
  Value(int x): k(NUM), n((double)x), b(false) {}
  Value(long long x): k(NUM), n((double)x), b(false) {}
  Value(unsigned long long x): k(NUM), n((double)x), b(false) {}
  Value(unsigned int x): k(NUM), n((double)x), b(false) {}
  Value(bool x): k(BOOL), n(0), b(x) {}
  Value(const char* x): k(STR), n(0), b(false), s(x) {}
  Value(const std::string& x): k(STR), n(0), b(false), s(x) {}
  Value(List x): k(LIST), n(0), b(false) { l = std::make_shared<List>(std::move(x)); }
};

struct RTError : std::runtime_error {
  std::string name;
  RTError(const std::string& nm): std::runtime_error(nm), name(nm) {}
};

inline bool rt_truthy(const Value& v) {
  if (v.k == Value::BOOL) return v.b;
  if (v.k == Value::NUM)  return v.n != 0;
  if (v.k == Value::STR)  return !v.s.empty();
  return v.l && !v.l->empty();
}
inline double rt_num(const Value& v) {
  return v.k == Value::NUM ? v.n : (v.k == Value::BOOL ? (v.b ? 1.0 : 0.0) : 0.0);
}
inline std::string rt_str(const Value& v) {
  if (v.k == Value::STR) return v.s;
  if (v.k == Value::NUM) { double x = v.n; if (x == (long long)x) return std::to_string((long long)x); return std::to_string(x); }
  if (v.k == Value::BOOL) return v.b ? "true" : "false";
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
inline Value rt_len(const Value& v) { if (v.k == Value::STR) return Value((double)v.s.size()); if (v.k == Value::LIST) return Value((double)v.l->size()); return Value(0.0); }
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
  throw RTError("IndexError: not indexable (kind " + std::to_string((int)o.k) + ")");
}
inline Value rt_push(Value l, Value v) { l.l->push_back(v); return l; }
inline Value rt_pop(Value l) { if (l.l->empty()) return Value(0.0); Value v = l.l->back(); l.l->pop_back(); return v; }
inline Value rt_unshift(Value l, Value v) { l.l->insert(l.l->begin(), v); return l; }
inline Value rt_set(Value l, Value i, Value v) { (*l.l)[(long long)rt_num(i)] = v; return l; }
inline Value rt_remove_at(Value l, Value i) { l.l->erase(l.l->begin() + (long long)rt_num(i)); return l; }
inline Value rt_rand(Value l) { if (l.l->empty()) return Value(0.0); return (*l.l)[rt_rng()() % l.l->size()]; }

inline Value rt_clock() { using namespace std::chrono; return Value((double)duration_cast<milliseconds>(steady_clock::now().time_since_epoch()).count() / 1000.0); }
inline Value rt_read_file(const Value& p) { std::ifstream f(rt_str(p)); if (!f) throw RTError("FileNotFoundError"); std::stringstream ss; ss << f.rdbuf(); return Value(ss.str()); }
inline Value rt_write_file(const Value& p, const Value& t) { std::ofstream f(rt_str(p)); f << rt_str(t); return Value(0.0); }

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
