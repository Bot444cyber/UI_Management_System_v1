interface ProductGalleryProps {
    product: any;
}

export default function ProductGallery({ product }: ProductGalleryProps) {
    const color = product.color || "bg-purple-500";

    return (
        <div className="flex flex-col gap-6">
            {/* Top Row */}
            <div className="flex flex-col gap-6">
                {/* Main Hero Image */}
                <div className={`relative aspect-[1.4/1] w-full overflow-hidden rounded-2xl ${color} bg-opacity-20 group cursor-zoom-in`}>
                    <div className="absolute inset-0 flex items-center justify-center transition-transform duration-700 group-hover:scale-105">
                        <div className="relative w-[98%] h-[98%] bg-zinc-900 rounded-xl shadow-2xl overflow-hidden border border-white/5 shadow-purple-500/20">
                            {/* Mock Content */}
                            <div className="absolute top-4 left-6 z-10 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg shadow-lg">
                                <h3 className="text-xs font-bold text-white tracking-wide">{product.title}</h3>
                            </div>
                            {product.imageSrc ? (
                                <img
                                    src={product.imageSrc}
                                    alt={product.title}
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                            ) : (
                                <div className="absolute bottom-0 right-0 w-3/4 h-3/4 bg-linear-to-br from-pink-400 to-purple-500 rounded-tl-3xl opacity-80" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Feature Grid removed - moved to separate component */}
            </div>

            {/* Bottom Row - Showcase Images */}
            {product.showcase && product.showcase.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {product.showcase.map((src: any, idx: number) => (
                        <div key={idx} className="aspect-square bg-zinc-900 rounded-2xl overflow-hidden relative group border border-white/5">
                            <img
                                src={src}
                                alt={`Showcase ${idx + 1}`}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
