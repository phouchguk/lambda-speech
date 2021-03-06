(require core mapreduce bootstrap-helper)

<h1>'(&lambda; speech)</h1>

<p>Go to the <a href="http://lambdaway.free.fr/workshop/?view=lambdaspeech">official '(&lambda; speech) site</a>.</p>
<p class="text-muted">Press ` or § to view console.</p>
<p>You can create a new page by appending #pagename to the url.</p>

(+ 1 2 3 4 5)

(def my-pair
 (cons Hello World))

<p>(cdr (my-pair))</p>

(def sw-icon
 (icon thumbs-(((= ok (sw-status))
                (cons
                  (lambda () up success)
                  (lambda () down danger))))))

<p id="test">Service worker: (sw-icon) (sw-status)</p>

<p>Go to <a href="#test">test page</a>.</p>

(def alot-of-args this is a lot of arguments)

((lambda (:x :y)
   <p><b>:x</b> :y<sup>'(1)</sup> :y<sup>'(2)</sup></p>)
 (alot-of-args))

((lambda (:x &:y)
   <p><b>:x</b> :y<sup>'(1)</sup> :y<sup>'(2)</sup>)
 (alot-of-args))

(mac let
 (lambda (innards)
   (+ 1 2 3)))

(let ((x 5) (y 7))
  (* x y))

(def called-later
 (lambda (&:x)
   (log! I was called after 3 seconds)
	 (inner-html! test :x)))

(def t/o (set-timeout! called-later 3000 (icon time success) Element contents updated.))

'(clear-timeout! (t/o))

<br>
(def my-list
 (cons 1 (cons 2 (cons 3 (cons 4 (cons 5 nil))))))

(foldl + 0 (mapr (lambda (:x) (* :x 2)) (my-list)))
(foldl + 0 (mapr identity (my-list)))
(foldl + 0 (mapr identity (reverse (my-list))))
