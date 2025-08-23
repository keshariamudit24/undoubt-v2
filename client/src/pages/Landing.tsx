import React, { useRef, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import NodesBg from "../components/NodesBg";

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
		title: "Get answers in real-time",
		desc: "Receive immediate responses to your questions during live sessions, fostering an interactive and engaging learning experience.",
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
	const isLeft = idx % 2 === 0;

	useEffect(() => {
		const observer = new IntersectionObserver(
			([entry]) => setVisible(entry.isIntersecting),
			{ threshold: 0.3 }
		);
		if (ref.current) observer.observe(ref.current);
		return () => observer.disconnect();
	}, []);

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
					<div className="w-8 h-8 rounded-full bg-cyan-500 text-zinc-900 flex items-center justify-center font-bold mr-3">
						{idx + 1}
					</div>
					<h3 className="text-xl font-semibold text-white">{step.title}</h3>
				</div>
				<p className="text-zinc-300 leading-relaxed">{step.desc}</p>
			</div>

			{/* Central dot for desktop */}
			<div
				className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-amber-500 border-4 border-zinc-900 z-10"
				style={{ zIndex: 10 }}
			/>
		</div>
	);
}

const Landing: React.FC = () => {
	const { signInWithGoogle, loading, isAuthenticated } = useAuth();
	const navigate = useNavigate();
	const [isSigningIn, setIsSigningIn] = useState(false);

	// Redirect if already authenticated
	useEffect(() => {
		if (isAuthenticated) {
			navigate('/dashboard');
		}
	}, [isAuthenticated, navigate]);

	const handleLogin = async () => {
		try {
			setIsSigningIn(true);
			await signInWithGoogle();
			// Navigation will happen automatically due to useEffect above
		} catch (error: any) {
			console.error('Login error:', error);
			alert(error.message || 'Failed to sign in. Please try again.');
		} finally {
			setIsSigningIn(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-zinc-900 flex items-center justify-center">
				<div className="text-white text-xl">Loading...</div>
			</div>
		);
	}

	return (
		<div className="font-sans bg-zinc-900 text-zinc-100">
			{/* Hero Section */}
			<section
				className="relative min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-zinc-900 to-zinc-800 px-4 overflow-hidden"
				id="hero"
			>
				{/* Animated nodes background */}
				<NodesBg
					className="absolute top-0 left-0 w-full h-full z-0"
					style={{ opacity: 0.18 }}
				/>
				<div className="relative z-10 flex flex-col items-center">
					<h1 className="text-5xl md:text-7xl font-bold mb-4 tracking-tight text-white drop-shadow-lg">
						Undoubt
					</h1>
					<p className="text-xl md:text-2xl mb-8 text-zinc-300">
						Ask freely. Learn fearlessly.
					</p>
					<button
						onClick={handleLogin}
						disabled={isSigningIn}
						className="px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-lg font-semibold shadow-xl transition-colors duration-200"
					>
						{isSigningIn ? 'Signing in...' : 'Login with College ID'}
					</button>
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

			{/* Benefits */}
			<section className="py-20 px-4 bg-zinc-800">
				<h2 className="text-3xl md:text-4xl font-bold mb-10 text-center text-white">
					Why Choose Undoubt?
				</h2>
				<div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
					{benefits.map((benefit, idx) => (
						<div
							key={benefit.title}
							className="p-6 rounded-xl bg-zinc-900 border border-cyan-500/20 hover:border-cyan-400 transition-colors
					shadow-[0_2px_12px_0_rgba(34,211,238,0.10)]
					hover:shadow-[0_0_24px_4px_rgba(34,211,238,0.45)]
					transition-shadow duration-300"
						>
							<h3 className="text-xl font-semibold mb-2 text-cyan-400">
								{benefit.title}
							</h3>
							<p className="text-zinc-300">{benefit.desc}</p>
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
};

export default Landing;
