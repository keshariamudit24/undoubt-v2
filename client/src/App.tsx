import React, { useRef, useEffect, useState } from "react";

// Steps with detailed descriptions
const steps = [
	{
		title: "Join with your college ID",
		desc: "Sign in securely using your college email or ID. This ensures only genuine participants can join the session, while keeping your identity hidden from peers.",
	},
	{
		title: "Ask doubts anonymously",
		desc: "Submit your questions without revealing your name. Your doubts are sent anonymously, encouraging you to ask anything without hesitation or fear of judgment.",
	},
	{
		title: "Moderator approves questions",
		desc: "A session moderator reviews all submitted questions to filter out irrelevant or inappropriate content, ensuring a safe and focused environment.",
	},
	{
		title: "Questions show on screen",
		desc: "Approved questions are displayed live on a shared screen for everyone to see, keeping the session interactive and transparent.",
	},
	{
		title: "Get answers live",
		desc: "The speaker or host addresses the questions in real-time, making sure every genuine doubt is heard and answered.",
	},
];

const benefits = [
	{
		title: "Anonymity",
		desc: "Ask questions without fear or hesitation. Your identity is hidden from peers.",
	},
	{
		title: "Inclusivity",
		desc: "Everyone gets a voice, even the shyest participants.",
	},
	{
		title: "Moderation",
		desc: "Only the host can see identities, ensuring accountability and filtering irrelevant content.",
	},
	{
		title: "Engagement",
		desc: "Live, anonymous Q&A boosts participation and learning.",
	},
];

function TimelineStep({
	step,
	idx,
	total,
}: {
	step: { title: string; desc: string };
	idx: number;
	total: number;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		const observer = new window.IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) setVisible(true);
			},
			{ threshold: 0.3 }
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	const isLeft = idx % 2 === 0;

	return (
		<div
			ref={ref}
			className={`
        relative w-full flex md:justify-between items-center mb-16 min-h-[180px]
        ${isLeft ? "md:flex-row" : "md:flex-row-reverse"}
        transition-all duration-700
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
      `}
		>
			{/* Step Card */}
			<div
				className={`
          w-full md:w-[45%] rounded-2xl border border-cyan-500 bg-zinc-900
          shadow-[0_8px_32px_0_rgba(34,211,238,0.25)]
          hover:shadow-[0_8px_40px_0_rgba(34,211,238,0.45)]
          p-6 md:p-8 flex flex-col
          ${isLeft ? "md:mr-8 md:ml-0" : "md:ml-8 md:mr-0"}
          transition-shadow duration-300
        `}
				style={{ zIndex: 2 }}
			>
				<div className="flex items-center mb-2">
					<span className="w-8 h-8 rounded-full border-2 border-cyan-400 flex items-center justify-center text-lg font-bold text-cyan-300 mr-3 bg-zinc-950 shadow-[0_0_12px_2px_rgba(34,211,238,0.3)]">
						{idx + 1}
					</span>
					<span className="text-xl font-semibold text-cyan-400">
						{step.title}
					</span>
				</div>
				<div className="text-zinc-300 text-base mt-2">{step.desc}</div>
			</div>

			{/* Connector line and dot */}
			<div className="hidden md:flex flex-col items-center absolute left-1/2 top-0 -translate-x-1/2 h-full z-0">
				<div className="w-1 h-full bg-cyan-600" />
				<span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-zinc-900 border-2 border-cyan-400 shadow-[0_0_12px_2px_rgba(34,211,238,0.5)]" />
			</div>
			{/* For mobile: show a vertical line on the left */}
			<div className="md:hidden absolute left-4 top-0 h-full flex flex-col items-center z-0">
				<div className="w-1 h-full bg-cyan-600" />
				<span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-zinc-900 border-2 border-cyan-400 shadow-[0_0_8px_1px_rgba(34,211,238,0.5)]" />
			</div>
		</div>
	);
}

export default function App() {
	return (
		<div className="font-sans bg-zinc-900 text-zinc-100">
			{/* Hero Section */}
			<section
				className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-zinc-900 to-zinc-800 px-4"
				id="hero"
			>
				<h1 className="text-5xl md:text-7xl font-bold mb-4 tracking-tight text-white drop-shadow-lg">
					Undoubt
				</h1>
				<p className="text-xl md:text-2xl mb-8 text-zinc-300">
					Ask freely. Learn fearlessly.
				</p>
				<a
					href="#"
					className="px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold shadow-xl transition"
				>
					Login with College ID
				</a>
				<div className="mt-16 animate-bounce">
					<a
						href="#about"
						aria-label="Scroll down"
						onClick={(e) => {
							e.preventDefault();
							document.getElementById("about")?.scrollIntoView({
								behavior: "smooth",
							});
						}}
					>
						<svg
							className="w-8 h-8 text-cyan-400"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</a>
				</div>
			</section>

			{/* About Us */}
			<section className="max-w-2xl mx-auto py-20 px-4" id="about">
				<h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
					About Undoubt
				</h2>
				<p className="text-lg text-zinc-300">
					Undoubt is an anonymous doubt-asking platform for seminars, workshops,
					and lectures. Participants can submit questions without revealing their
					identity, encouraging open and honest engagement. Only the host can see
					who asked what, ensuring accountability and a safe environment.
				</p>
			</section>

			{/* How It Works */}
			<section
				className="bg-zinc-900 py-20 px-4"
				id="how"
			>
				<h2 className="text-3xl md:text-4xl font-bold mb-10 text-center text-white">
					How It Works
				</h2>
				<div className="relative max-w-4xl mx-auto">
					{/* Central vertical line for desktop */}
					<div className="hidden md:block absolute left-1/2 top-0 -translate-x-1/2 h-full w-1 bg-amber-700 z-0" />
					{/* Timeline steps */}
					<div className="flex flex-col relative z-10">
						{steps.map((step, idx) => (
							<TimelineStep
								key={step.title}
								step={step}
								idx={idx}
								total={steps.length}
							/>
						))}
					</div>
				</div>
			</section>

			{/* Why Use Undoubt */}
			<section
				className="py-20 px-4 bg-gradient-to-br from-zinc-800 to-zinc-900"
				id="why"
			>
				<h2 className="text-3xl md:text-4xl font-bold mb-10 text-center text-white">
					Why Use Undoubt?
				</h2>
				<div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
					{benefits.map((b) => (
						<div
							key={b.title}
							className="rounded-2xl bg-zinc-900 shadow-2xl p-8 flex flex-col items-start hover:shadow-cyan-400/20 hover:shadow-2xl transition border border-zinc-800"
						>
							<h3 className="text-xl font-semibold mb-2 text-cyan-400">
								{b.title}
							</h3>
							<p className="text-zinc-300">{b.desc}</p>
						</div>
					))}
				</div>
			</section>

			{/* Footer */}
			<footer className="py-8 px-4 bg-zinc-800 border-t border-zinc-700 text-center">
				<nav className="mb-2">
					<a
						href="#about"
						className="mx-2 text-cyan-400 hover:underline"
					>
						About Us
					</a>
					<a
						href="mailto:contact@undoubt.com"
						className="mx-2 text-cyan-400 hover:underline"
					>
						Contact
					</a>
				</nav>
				<div className="text-zinc-500 text-sm">
					&copy; {new Date().getFullYear()} Undoubt. All rights reserved.
				</div>
			</footer>
		</div>
	);
}
