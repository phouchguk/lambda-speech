(def console-toggle
 (lambda (:key)
   (((= ` :key)
	   (cons
		   (lambda () (toggle! code))
			 (lambda ()))))))

(def refresh
 (lambda (_)
   (inner-html! view (eval-el-val code))))

(def stop-console-key
 (lambda (:key)
   (not (= ` :key))))

(listen! keydown code stop-console-key)
(listen! keyup code refresh)
(listen! keyup body console-toggle)
