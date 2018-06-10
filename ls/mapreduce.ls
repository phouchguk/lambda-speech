(require core)

(def foldl
 (lambda (:f :acc :xs)
   (((nil? :xs)
      (cons
       (lambda (_ :acc _) :acc)
       (lambda (:f :acc :xs)
         (foldl :f (:f :acc (car :xs)) (cdr :xs))))
     ) :f :acc :xs)))

(def mapr
 (lambda (:f :xs)
   (foldl
   ((lambda (:f :acc :x) (cons (:f :x) :acc)) :f)
    nil
    :xs)))

(def identity
 (lambda (:x) :x))

(def reverse
 (lambda (:xs)
   (mapr identity :xs)))

(def map
 (lambda (:f :xs)
   (reverse (mapr :f :xs))))
