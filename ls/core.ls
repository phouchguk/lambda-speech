(def cons
 (lambda (:x :y :z)
   (:z :x :y)))

(def car
 (lambda (:z)
   (:z (lambda (:x :y) :x))))

(def cdr
 (lambda (:z)
  (:z (lambda (:x :y) :y))))

(def nil
 (lambda (:f :x) :x))

(def nil?
 (lambda (:n)
   (:n (lambda (&:x) cdr) car)))
