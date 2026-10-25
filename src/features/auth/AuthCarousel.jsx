import Image from "next/image";
import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import Lottie from "lottie-react";
import Animation1 from "/public/image/business-salesman.json";
import Animation2 from "/public/image/web-design-layout.json";
import Animation3 from "/public/image/email-marketing.json";

const EmblaCarousel = ({ slides, options }) => {
  // Define autoplay options outside of the hook setup.
  const autoplayOptions = {
    delay: 5000,
    stopOnInteraction: true,
  };

  // Always call the hook unconditionally at the top of your component.
  const [emblaRef, emblaApi] = useEmblaCarousel(options, [
    Autoplay(autoplayOptions),
  ]);

  // After hook calls, you can handle any conditional rendering.
  if (!slides || slides.length === 0) {
    return <div>No slides available</div>;
  }

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
                    slide.animation === "salesman"
                      ? Animation1
                      : slide.animation === "design"
                      ? Animation2
                      : Animation3
                  }
                  autoplay
                  loop
                />
              )}
              <div className="text-center space-y-2">
                <div className="font-semibold">{slide.title}</div>
                <div className="text-sm text-[#6B7F71]">
                  {slide.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EmblaCarousel;
