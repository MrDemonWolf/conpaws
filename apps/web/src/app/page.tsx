'use client';

import { useState } from 'react';
import { Calendar, Share2, WifiOff, Github } from 'lucide-react';

const FEATURES = [
  {
    icon: Calendar,
    title: 'Convention Calendar',
    description:
      'Import schedules from any convention. Browse panels, events, and activities at a glance.',
  },
  {
    icon: Share2,
    title: 'Share & Connect',
    description:
      'Build your personal schedule and share it with friends attending the same con.',
  },
  {
    icon: WifiOff,
    title: 'Works Offline',
    description:
      'All your data is stored locally. No internet required once you\u2019ve imported your schedule.',
  },
];

interface FormState {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
}

export default function HomePage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [form, setForm] = useState<FormState>({ status: 'idle', message: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.status === 'loading') return;

    setForm({ status: 'loading', message: '' });

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.conpaws.com';
      const res = await fetch(`${apiUrl}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, honeypot }),
      });

      const data = await res.json() as { success?: boolean; error?: string };

      if (data.success) {
        setForm({ status: 'success', message: 'You\u2019re on the list! We\u2019ll reach out when ConPaws launches.' });
        setName('');
        setEmail('');
      } else {
        setForm({ status: 'error', message: data.error ?? 'Something went wrong. Please try again.' });
      }
    } catch {
      setForm({ status: 'error', message: 'Network error. Please try again.' });
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center gap-6">
        <div className="w-20 h-20 rounded-3xl bg-[#0FACED] flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-[#0FACED]/30">
          CP
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            ConPaws
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-xl">
            Navigate, Connect, Enjoy — Your furry convention companion
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#0F1D45] border border-[#1e3a5f] px-4 py-2 rounded-full text-sm text-slate-400">
          <span className="w-2 h-2 rounded-full bg-[#0FACED] animate-pulse" />
          Coming to iOS &amp; Android
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-12 max-w-4xl mx-auto w-full">
        <div className="grid md:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-[#0F1D45] border border-[#1e3a5f] rounded-2xl p-6 flex flex-col gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-[#0FACED]/10 flex items-center justify-center">
                <feature.icon size={20} className="text-[#0FACED]" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                <p className="text-sm text-slate-400">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Beta signup */}
      <section className="px-6 py-12 max-w-lg mx-auto w-full" id="signup">
        <div className="bg-[#0F1D45] border border-[#1e3a5f] rounded-2xl p-8 flex flex-col gap-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Get Early Access</h2>
            <p className="text-slate-400 text-sm">
              Be the first to know when ConPaws launches. No spam, just the launch announcement.
            </p>
          </div>

          {form.status === 'success' ? (
            <div className="text-center py-4">
              <p className="text-[#0FACED] font-medium">{form.message}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {/* Honeypot — hidden from humans */}
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                style={{ display: 'none' }}
              />
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-[#091533] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#0FACED] transition-colors"
              />
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-[#091533] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#0FACED] transition-colors"
              />
              {form.status === 'error' && (
                <p className="text-red-400 text-sm">{form.message}</p>
              )}
              <button
                type="submit"
                disabled={form.status === 'loading'}
                className="bg-[#0FACED] text-white font-semibold py-3 px-6 rounded-xl hover:bg-[#0FACED]/90 active:bg-[#0FACED]/80 disabled:opacity-50 transition-colors"
              >
                {form.status === 'loading' ? 'Joining...' : 'Notify Me at Launch'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#1e3a5f] px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>© 2026 ConPaws. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="hover:text-[#0FACED] transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-[#0FACED] transition-colors">Terms</a>
            <a
              href="https://discord.gg/conpaws"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#0FACED] transition-colors"
            >
              Discord
            </a>
            <a
              href="https://github.com/mrdemonwolf/conpaws"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#0FACED] transition-colors flex items-center gap-1"
            >
              <Github size={14} />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
