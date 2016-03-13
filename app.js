var app = angular.module('app',[]);

app.controller("listController",function($scope){
  
    $scope.list = 
    [
        {name:'tool1'},
        {name: 'tool2'},
        {name: 'tool3'},
        {name: 'tool4'},
        {name: 'tool5'},
        {name:'tool6'},
        {name: 'tool7'},
        {name: 'tool8'},
        {name: 'tool9'},
        {name: 'tool10'},
        {name:'tool11'},
        {name: 'tool12'},
        {name: 'tool13'},
        {name: 'tool14'},
        {name: 'tool15'},
        {name:'tool16'},
        {name: 'tool17'},
        {name: 'tool18'},
        {name: 'tool19'},
        {name: 'tool20'}
    ];
}).service("draggable",function(){
    var scope = this;
        scope.inputEvent = function(event) {
            if (angular.isDefined(event.touches)) {
                return event.touches[0];
            }
            //Checking both is not redundent. If only check if touches isDefined, angularjs isDefnied will return error and stop the remaining scripty if event.originalEvent is not defined.
            else if (angular.isDefined(event.originalEvent) && angular.isDefined(event.originalEvent.touches)) {
                return event.originalEvent.touches[0];
            }
            return event;
        };
        
        scope.OnDragBegin= function(data,event){
            
        };
        
        scope.OnDragEnd = function(data,event){
            
        };
        
        scope.OnDragSuccess = function(data,event){
            if(event.$items){
                var index = angular.element(event.drpEle).scope().$index;
                changeListItems(event.$items,event.$data,index);
            }
        };
        
        var changeListItems = function(list, changeItem, changeIndex){
            if(changeIndex){
                var otherObj = list[changeIndex];
                var otherIndex = list[changeItem];
                
                list[changeIndex] = changeItem;
                list[otherIndex] = otherObj;
                
            }else{
                
                var itemIndex = list.indexOf(changeItem);
                if(itemIndex === -1){
                    list.push(changeItem);
                }
                
            }
        };
        
        scope.applyTransformStyle = function(element,applyTransform,x,y){
            if(applyTransform){
                element.css({
                            transform: 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ' + x + ', ' + y + ', 0, 1)',
                            'z-index': 99999,
                            '-webkit-transform': 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ' + x + ', ' + y + ', 0, 1)',
                            '-ms-transform': 'matrix(1, 0, 0, 1, ' + x + ', ' + y + ')'
                        });
            }else{
                element.css({'left':x+'px','top':y+'px', 'position':'fixed'});
            }
        };
        
        scope.resetTransformStyle = function(element, applyTransform){
            if(applyTransform){
                element.css({transform:'', 'z-index':'', '-webkit-transform':'', '-ms-transform':''});
            }else{
                element.css({'position':'',top:'',left:''});
            }
        };
}).directive('anDrag',['$rootScope','$parse','$timeout','$window','$document','draggable',function (
    $rootScope,$parse,$timeout,$window,$document,draggable
) {
    return{
        restrict:'A',
        link:function(scope,element,attrs){
            var containment;
            var _dragHandler;
            var outerOffset;
            
            var _mode = true;//$parse(attrs.dragMode),
            var _dragContainer = attrs.dragContainment;
            var _containment = false;
            
            var _onlyDrag = $parse(attrs.DragOnly);
            
            var mouseX,mouseY;
            
            var Offset,_centerAnchor = false,_mx,_my,_tx,_ty,_mrx,_mry;
            
            var _hasTouch = ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch;
            var _pressEvents = 'touchstart mousedown';
            var _moveEvents = 'touchmove mousemove';
            var _releaseEvents = 'touchend mouseup';
            
            var _myid = scope.$id, _data = null, _dragOffset = null, _dragEnabled = true;
            var _pressTimer = null;
            var allowTransform = false;//
            var getDragData = $parse(attrs.DragData);
            
            var _deregisterRootMoveListner = angular.noop;
            
            var dragClass = "dragging";
            var isdragCancelled = false;
            
            var onDragBeginCallback = $parse(attrs.DragBegin);
            var onDragEndCallback = $parse(attrs.DragEnd);
            var onDragSuccessCallback = $parse(attrs.DragSuccess);
            
            var registerCallbackEvents= function(){
                if(attrs.DragBegin){
                    onDragBeginCallback = $parse(attrs.DragBegin);
                }else{
                    onDragBeginCallback = $parse(draggable.OnDragBegin);
                }
                
                if(attrs.DragEnd){
                    onDragEndCallback = $parse(attrs.DragEnd);
                }else{
                    onDragEndCallback = $parse(draggable.OnDragEnd);
                }
                
                if(attrs.DragSuccess){
                    onDragSuccessCallback = $parse(attrs.DragSuccess);
                }else{
                    onDragSuccessCallback = $parse(draggable.OnDragSuccess);
                }
            };
            
            var initializeDrag = function(){
                element.attr('draggable','false');
                var dragHandles;
                if (element[0].querySelectorAll) {
                        dragHandles = angular.element(element[0].querySelectorAll('[ng-drag-handle]'));
                    } else {
                        dragHandles = element.find('[ng-drag-handle]');
                    }
                    if (dragHandles.length) {
                        _dragHandle = dragHandles;
                    }
               
               scope.$on('$destroy',destroyOnTaskComplete);
               scope.$watch(attrs.anDrag,dragValueChange);
               scope.$watch(attrs.CenterAnchor,changeCenterAnchor);
               scope.$watch(attrs.DragMode,modeChange);
               scope.$watch(attrs.DragOnly,dragOnlyChange);
               
               if (_dragHandler) {
                        // handle(s) specified, use those to initiate drag
                        _dragHandler.on(_pressEvents, onDragElementPress);
                    } else {
                        // no handle(s) specified, use the element as the handle
                        element.on(_pressEvents, onDragElementPress);
                    }
                    if(! _hasTouch && element[0].nodeName.toLowerCase() == "img"){
                        element.on('mousedown', function(){ return false;}); // prevent native drag for images
                    }
                    
                if(_dragContainer){
                    containment = angular.element(document.getElementById(_dragContainer));
                    outerOffset = containment[0].getBoundingClientRect();
                    _containment = true;
                }
            };
            
            var onDragElementPress = function(evt){
                if (getElementAttribute(evt,'ci-cancel-drag')) {
                        return;
                    }

                    if (evt.type == "mousedown" && evt.button === 2) {
                        // Do not start dragging on right-click
                        return;
                    }

                    if(_hasTouch){
                        cancelOnPress();
                        _pressTimer = setTimeout(function(){
                            cancelOnPress();
                            registerMouseEvents(evt);
                        },100);
                        $document.on(_moveEvents, cancelOnPress);
                        $document.on(_releaseEvents, cancelOnPress);
                    }else{
                        registerMouseEvents(evt);
                    }
            };
            
            var registerMouseEvents = function(evt){
                evt.preventDefault();
                
                offset = element[0].getBoundingClientRect();
                if(allowTransform){
                    _dragOffset = offset;
                }else{
                    _dragOffset = {left: document.body.scrollLeft, top: document.body.scrollTop};
                }
                
                getInitialPositions(evt);
                
                $document.on(_moveEvents,onDragElementMove);
                $document.on(_releaseEvents,onDragRelease);
                
                DeregisterRootMoveListner();
            };
            
            var getInitialPositions = function(e){
                element.centerX = element[0].offsetWidth / 2;
                element.centerY = element[0].offsetHeight / 2;
                
                _mx = draggable.inputEvent(e).pageX;
                _my = draggable.inputEvent(e).pageY;
                
                _tx= _mx - element.centerX - $window.pageXOffset;
                _ty= _my - element.centerY - $window.pageYOffset;
            };
            
            var updatePositions = function(e){
               _mx = draggable.inputEvent(e).pageX;
                _my = draggable.inputEvent(e).pageY;
                
                 _tx= _mx - element.centerX - $window.pageXOffset;
                _ty= _my - element.centerY - $window.pageYOffset;
            };
            
            var DeregisterRootMoveListner = function(){
                $rootScope.$on('draggable:_triggerHandlerMove', function(event, origEvent) {
                        onDragElementMove(origEvent);
                    });
            };
            
            var onDragElementMove = function(evt){
                if(!_mode){
                    return;
                }
                
                evt.preventDefault();
                
                if(dragClass){
                    element.addClass(dragClass);
                }else{
                    toggleBackgroundTransperant(element,true);
                }
                
                _data = getDragData(scope);
                
                $rootScope.$broadcast('draggable:begin', {x:_mx, y:_my, tx:_tx, ty:_ty, event:evt, element:element, data:_data});

                        if (onDragBeginCallback ){
                            scope.$apply(function () {
                                onDragBeginCallback(scope, {$data: _data, $event: evt});
                            });
                        }
                        
                if(_containment){
                    resetDragContainer(element);
                }
                
                updatePositions(evt);
                draggable.applyTransformStyle(element,allowTransform,_tx,_ty);
                
                $rootScope.$broadcast('draggable:change', { x: _mx, y: _my, tx: _tx, ty: _ty, event: evt, element: element, data: _data, uid: _myid, dragOffset: _dragOffset, dragOnly:_onlyDrag });
                
                if(_ty > 0){
                    //scroll down
                    if(_ty > $('[ci-content]').height()){
                       $('[ci-content]').scrollTop($('[ci-content]').scrollTop() + 1);
                    }else{
                         $('[ci-content]').scrollTop($('[ci-content]').scrollTop() - 1);
                    }
                }else{
                    
                }
            };
            
            var onDragRelease = function(evt){
                evt.preventDefault();
                
                if(!element.hasClass(dragClass)){
                    isdragCancelled = true;
                    element.removeClass(dragClass);
                    return;
                }
                
                if(dragClass){
                    element.removeClass(dragClass);
                }else{
                    toggleBackgroundTransperant(element,false);
                }
                
                 element.parent().find('.drag-enter').removeClass('drag-enter');
                 
                 draggable.resetTransformStyle(element, allowTransform);
                 
                 $document.off(_moveEvents,onDragElementMove);
                 $document.off(_releaseEvents,onDragRelease);
                 
                 if(_mode){
                      $rootScope.$broadcast('draggable:end', {x:_mx, y:_my, tx:_tx, ty:_ty, event:evt, element:element, data:_data, callback:dragCompleteEvent, uid: _myid});
                      if (onDragEndCallback ){
                        scope.$apply(function () {
                            onDragEndCallback(scope, {$data: _data, $event: evt});
                        });
                    }

                    DeregisterRootMoveListner();
                 }
                    
            };
            
            var toggleBackgroundTransperant = function(element, enable){
                if(enable){
                    element.attr('opacity','0.4');
                }else{
                     element.attr('opacity','0');
                }
            };
            
            var getElementAttribute = function(evt, attributeName){
                return (
                    angular.isDefined(angular.element(evt.target).attr(attributeName))
                    );
            };
            
            var resetDragContainer = function(){
                var containerWidth = containment.outerWidth() - offset.width;
                var elementMovedX = offset.left + _tx;
                if(_tx > 0){
                    if(elementMovedX > containerWidth){
                        var x = containerWidth - offset.left;
                        _tx =Math.round(x);
                    }
                }else{
                    if(elementMovedX < outerOffset.left){
                        var x = offset.left - outerOffset.left;
                        _tx = parseInt('-' + x);
                    }
                }
                
                var containerWidth = containment.outerHeight();
                var elementMovedY = offset.top + _ty;
                if(_ty > 0){
                    if(elementMovedY > containerWidth){
                        var y = containerWidth - offset.top;
                        _ty =Math.round(y);
                    }
                }else{
                    if(elementMovedY < outerOffset.top){
                        var y = offset.top - outerOffset.top;
                        _ty = parseInt('-' + y);
                    }
                }
            };
            
            var cancelOnPress = function(){
                clearTimeout(_pressTimer);
                
                $document.off(_moveEvents,cancelOnPress);
                $document.off(_releaseEvents,cancelOnPress);
            };
            
            var modeChange = function(newVal, oldVal){
                _mode = true;//newVal;
            };
            
            var destroyOnTaskComplete = function(){
                
            };
            
            var dragValueChange = function(newVal, oldVal){
                if(!_dragEnabled){_dragEnabled = newVal;}
            };
            
            var dragOnlyChange = function(newVal, oldVal){
                _onlyDrag = newVal;
            };
            
            var changeCenterAnchor = function(newVal, oldVal){
                if(angular.isDefined(newVal)){
                    _centerAnchor = (newVal || 'true');
                }
            };
            
            var dragCompleteEvent = function(evt){
                if(!onDragSuccessCallback) return;
                
                scope.$apply(function(){
                    onDragSuccessCallback(scope, {$data: _data, $event:evt});
                });
            };
            
            initializeDrag();
           
        }
    }
}]).directive('anDrop',['$parse','$timeout','$window','$document','draggable',function (
    $parse,$timeout,$window,$document,draggable
) {
    return{
        restrict:'A',
        link:function(scope,element,attrs){
            scope.value = attrs.anDrop;
            scope.isTouching = false;
            
            var _lastDropTouch=null,_myid=scope.$id,_dropEnabled=true,
            _placeholder,//="<div class='col-xs-8 col-sm-6 col-sm-4 placeholdersort' style='visibility:hidden;'></div>",
            
            _listItemCollection = attrs.dropList,targetObject={};
                        var onDropCallback = $parse(attrs.dropSuccess);
            
            var onDragBeginCallback,onDragEndCallback,onDragChangeCallback;
            
            var initializeDrop = function(){
                scope.$watch(attrs.Drop,switchOnOffDrop);
                scope.$on('$destroy',destroyOnTaskComplete);
                
                scope.$on('draggable:begin',onDragBegin);
                scope.$on('draggable:change',onDragChange);
                scope.$on('draggable:end',onDragEnd);
                
                registerCallbackEvents();
                
                if(!_placeholder){
                    _placeholder = element[0].cloneNode(true);
                }
                
            };
            
            var registerCallbackEvents = function(){
                if(attrs.dragBegin){
                    onDragBeginCallback = $parse(attrs.dragBegin);
                }else{
                    onDragBeginCallback = $parse(draggable.dragBegin);
                }
                
                if(attrs.dragEnd){
                    onDragEndCallback = $parse(attrs.dragEnd);
                }else{
                    onDragEndCallback = $parse(draggable.dragEnd);
                }
                
                if(attrs.dropSuccess){
                    onDropCallback = $parse(attrs.dropSuccess);
                }else{
                    onDropCallback = $parse(draggable.dropSuccess);
                }
                
            };
            
            var destroyOnTaskComplete = function(){
                scope.$off('draggable:begin',onDragBegin);
                scope.$off('draggable:change',onDragChange);
                scope.$off('draggable:end',onDragEnd);
            };
            
            var switchOnOffDrop = function(newVal,oldVal){
                if(!_dropEnabled){
                    _dropEnabled = newVal;
                }
            };
            
            var onDragBegin = function(evt,obj){
                isTouchingContainer(obj.x,obj.y,obj);
                
                if(onDragBeginCallback){
                    $timeout(function () {
                        onDragBeginCallback(scope,{$data: obj.data, $event : obj});
                    })
                }
            };
            
            var onDragChange = function(evt,obj){
                var isInDropElement = isTouchingContainer(obj.x,obj.y,obj);
                
                if(onDragChangeCallback){
                    $timeout(function () {
                        onDragChangeCallback(scope,{$data : obj.data, $event : obj});
                    })
                }
                
                var isCrossing = isDragCrossingDrop(obj.x,obj.y);
                if(isCrossing == true){
                    openSpaceForNew(evt,obj);
                }
            };
            
            var onDragEnd = function(evt, obj){
                synchronizeHtmlElements();
                $('[ci-content]').stop();
                
                if(!obj.data) return;
                
                if(!_dropEnabled || _myid === obj.uid){
                    applyStylesForDrag(false,obj);
                    
                    return;
                }
                
                if(isTouchingContainer(obj.x,obj.y,obj)){
                    var target = getTargetDetails(obj);
                    
                    if(obj.callback){
                        obj.callback(obj);
                    }
                    
                    if(onDropCallback){
                        $timeout(function () {
                            onDropCallback(scope,{$data : obj.data, $event : obj, $target : target});
                        });
                    }
                }
                
                 if(onDragEndCallback){
                        $timeout(function(){
                            onDragEndCallback(scope,{$data:obj.data, $event : obj});
                        });
                    }
                    
                    applyStylesForDrag(false,obj);
            };
            
            var getTargetDetails= function(dragItem){
                var elementScope = angular.element(element).scope();
                var currentIndex = elementScope.$index;
                var targetElement = element;
                var list =[];
                
                if(_listItemCollection){
                    list = elementScope[_listItemCollection];
                }
                
                targetObject = {
                    'currentItemIndex': elementScope.$index,
                    'targetElement': element,
                    'list': list,
                    'dragOnly': dragItem.dragOnly
                }
                
                return targetObject;
            };
            
            var isTouchingContainer = function(mouseX,mouseY,dragObj){
                var touching = isDragAvailable(mouseX,mouseY);
                scope.isTouching = touching;
                if(touching){
                    _lastDropTouch = element;
                }
                
                applyStylesForDrag(touching,dragObj);
                return touching;
            };
            
            var applyStylesForDrag = function(touching,dragObj){
                var dragElement = dragObj.element;
                if(touching){
                    element.addClass('drag-enter');
                    dragElement.addClass('drag-over');
                }else if(_lastDropTouch === element){
                    _lastDropTouch = null;
                    element.removeClass('drag-enter');
                    dragElement.removeClass('drag-over');
                }
            };
            
            var openSpaceForNew = function(event, dragElementObj){
                var elementScope = angular.element(element).scope();
                var currentIndex = elementScope.$index;
                
                var dragScope = angular.element(dragElementObj.element[0]).scope();
                if(!dragScope){return;}
                var dragIndex = dragScope.$index;
                console.log(dragIndex);
                console.log(currentIndex);
                if(currentIndex != dragIndex){
                    
                    var listObject = getTargetDetails(dragElementObj);
                    if(listObject.list){
                        if(listObject.list.length > 0){
                            if(!element.hasClass("drag-enter")){
                                return;
                            }
                            
                            //$(_placeholder).remove();
                            $timeout(function(){
                                var currentObject = listObject.list[currentIndex];
                                var targetObject = listObject.list[dragIndex];
                                
                                var dragElmIndx =$(angular.element(dragElementObj.element)).parent().index();
                                var dropIndex = $(element).index();
                                
                                if(dragElementObj.dragOnly){
                                    synchronizeHtmlElements();
                                    $(_placeholder).insertBefore(element);
                                    $(_placeholder).addClass("placeholdersort");
                                }else{
                                    
                                    //listObject.list.splice(currentIndex,0,listObject.list.splice(dragIndex,1)[0]);
                                    
                                    //replace logic
                                    //find the difference between the elements
                                    var difference = dragElmIndx - dropIndex;
                                    console.log(dragElmIndx);
                                    console.log(dropIndex);
                                    //check for immidiate previous
                                    if(dragElmIndx + 1 === dropIndex){
                                        $(element).stop();
                                        $(element).animate({
                                            left:"-"+ $(element).width()
                                        },500,function(){
                                            $(this).insertBefore($(dragElementObj.element[0]).parent());
                                            $(this).css('left','');
                                        });
                                    }
                                    
                                    //check for immidiate next
                                     if(dragElmIndx - 1 === dropIndex){
                                        $(element).stop();
                                        $(element).animate({
                                            left: $(element).width()
                                        },500,function(){
                                            $($(dragElementObj.element[0]).parent()).insertBefore($(this));
                                            $(this).css('left','');
                                        });
                                    }
                                    
                                    //check for up and down
                                    if(dragElmIndx < dropIndex && dragElmIndx + 1 !== dropIndex){
                                        //find the next element of drag
                                        var next = $(dragElementObj.element[0]).parent().next();
                                        $(next).stop();
                                        $(next).animate({
                                            left:"-"+ $(next).width()
                                        },500,function(){
                                            $(this).css('left','');
                                            $($(dragElementObj.element[0]).parent()).insertAfter($(element));
                                            $(element).css('left','');
                                        });
                                    }
                                  
                                    if(dragElmIndx > dropIndex && dragElmIndx - 1 !== dropIndex){
                                        //find the next element of drag
                                       
                                        var next = $(dragElementObj.element[0]).parent().next();
                                       
                                        if(next.length != 0){
                                            $(next).stop();
                                            $(next).animate({
                                                left:"-"+ $(next).width()
                                            },500,function(){
                                                $(this).css('left','');
                                                $($(dragElementObj.element[0]).parent()).insertBefore($(element));
                                                $(element).css('left','');
                                            });
                                        }else{
                                            $(element).stop();
                                            $(element).animate({
                                                left: $(element).width()
                                            },500,function(){
                                                $($(dragElementObj.element[0]).parent()).insertBefore($(this));
                                                $(this).css('left','');
                                            });
                                        }
                                        
                                    }
                                    
                                    //listObject.list.splice(currentIndex,0,listObject.list.splice(dragIndex,1)[0]);
                                    
                                    //Add placeholder before the target element
                                    //$(_placeholder).insertAfter(element);
                                   // $(_placeholder).addClass("placeholdersort");
                                    
                                    //Replace target with drag element
                                    //$(_placeholder).replaceWith($(dragElementObj.element[0]).parent());
                                    //$(_placeholder).detach();
                                    
                                    //working from bottom to up
                                    //$(element).before($(dragElementObj.element[0]).parent());
                                    
                                    if($("div.placeholdersort").length == 0){
                                        //$(_placeholder).insertAfter($(dragElementObj.element[0]).parent());
                                        //$(_placeholder).addClass("placeholdersort").css('display','none');
                                        
                                        //$(element).insertBefore($(dragElementObj.element).parent());
                                        
                                         //$(_placeholder).insertBefore($(element));
                                         //$(_placeholder).css('visibility','hidden');
                                         //$(element).insertBefore($(dragElementObj.element).parent());
                                         //$(_placeholder).insertBefore($(element)).insertBefore($(dragElementObj.element).parent());
                                         
                                    }else{
                                         //$(".placeholdersort").insertAfter($(dragElementObj.element[0]).parent());
                                         //$(element).insertBefore($(dragElementObj.element).parent());
                                         
                                         //$(".placeholdersort").insertBefore($(element));
                                         
                                         //$(element).insertBefore($(dragElementObj.element).parent());
                                         //$(".placeholdersort").insertBefore($(dragElementObj.element).parent()).insertBefore($(element));
                                    }
                                   
                                  
                                    
                                   
                                }                           
                            });
                        }
                    }
                }  
              
            };
            
            var synchronizeHtmlElements = function(){
                //$("div.placeholdersort").remove();
            };
            
            var isDragCrossingDrop = function(x,y){
                var bounds = element[0].getBoundingClientRect();
                var elmObj = $(element[0]);
                
                var cx = bounds.left + elmObj.width() / 2;
                var cy = bounds.top + elmObj.height() / 2;
                
                var isIn = false;
                if(x >= cx && x <= bounds.right -10 && y >= cy && y <= bounds.bottom -10){
                    isIn = true;
                }
                
                return isIn;
            };
            
            var isDragAvailable = function(x,y){
                var bounds = element[0].getBoundingClientRect();// ngDraggable.getPrivOffset(element);
                    x -= $document[0].body.scrollLeft + $document[0].documentElement.scrollLeft;
                    y -= $document[0].body.scrollTop + $document[0].documentElement.scrollTop;
                    return  x >= bounds.left
                        && x <= bounds.right
                        && y <= bounds.bottom
                        && y >= bounds.top;
            };
            
            initializeDrop();
        }
    }
}]);