"use client";

import Image from "next/image";
import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import Lottie from "lottie-react";
import Animation1 from "/public/image/business-salesman.json"
import Animation2 from "/public/image/web-design-layout.json"
import Animation3 from "/public/image/email-marketing.json"



const EmblaCarousel = ({ slides, options }) => {
  if (!slides) {
    return <div>No slides available</div>;
}

  const autoplayOptions = {
    delay: 5000,
    stopOnInteraction: true,
  };

  const [emblaRef, emblaApi] = useEmblaCarousel(options, [
    Autoplay(autoplayOptions),
  ]);
  return (
    <section className="embla">
            <div className="embla__viewport" ref={emblaRef}>
                <div className="embla__container">
                    {slides.map((slide, index) => (
                        <div className="embla__slide" key={index}>
                            {slide.type === "image" ? (
                                <Image
                                    src={slide.src}
                                    alt={slide.alt}
                                    width={slide.width}
                                    height={slide.height}
                                    layout="responsive"
                                />
                            ) : (
                              <Lottie
                              animationData={
                                slide.animation === 'salesman'
                                  ? Animation1
                                  : slide.animation === 'design'
                                  ? Animation2
                                  : Animation3
                              }
                              autoplay
                              loop
                            />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
  );
};

export default EmblaCarousel;
