import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MockupGenerator from "@/components/mockups/MockupGenerator";

export default function MockupsPage() {
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30">
            <Header />

            <main className="mx-auto max-w-[1600px] px-4 pt-24 pb-12 md:px-6 md:pt-32 md:pb-12">
                <div className="mb-12 text-center max-w-2xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent mb-6">
                        Instant Mockups
                    </h1>
                    <p className="text-zinc-400 text-lg">
                        Turn your flat designs into professional product shots in seconds.
                        Just upload and let the magic happen.
                    </p>
                </div>

                <MockupGenerator />
            </main>

            <Footer />
        </div>
    );
}
