L.Edit = L.Edit || {};

/**
 * @class L.Edit.Polyline
 * @aka L.Edit.Poly
 * @aka Edit.Poly
 */
L.Edit.Poly = L.Handler.extend({
	// @method initialize(): void
	initialize: function (poly) {
		this.latlngs = [poly._latlngs];
		if (poly._holes) {
			this.latlngs = this.latlngs.concat(poly._holes);
		}

		this._poly = poly;

		this._poly.on("revert-edited", this._updateLatLngs, this);
		// this._poly.LatLngUtil.
		// when init poly
		console.log("init edit poly: ", poly);
	},

	// Compatibility method to normalize Poly* objects
	// between 0.7.x and 1.0+
	_defaultShape: function () {
		if (!L.Polyline._flat) {
			return this._poly._latlngs;
		}
		return L.Polyline._flat(this._poly._latlngs)
			? this._poly._latlngs
			: this._poly._latlngs[0];
	},

	_eachVertexHandler: function (callback) {
		for (var i = 0; i < this._verticesHandlers.length; i++) {
			callback(this._verticesHandlers[i]);
		}
	},

	// @method addHooks(): void
	// Add listener hooks to this handler
	addHooks: function () {
		this._initHandlers();
		this._eachVertexHandler(function (handler) {
			handler.addHooks();
		});
	},

	// @method removeHooks(): void
	// Remove listener hooks from this handler
	removeHooks: function () {
		this._eachVertexHandler(function (handler) {
			handler.removeHooks();
		});
	},

	// @method updateMarkers(): void
	// Fire an update for each vertex handler
	updateMarkers: function () {
		this._eachVertexHandler(function (handler) {
			handler.updateMarkers();
		});
	},

	//init handlers are called for every polygon
	_initHandlers: function () {
		// console.log("init use latlngs", this.latlngs);
		this._verticesHandlers = [];
		for (var i = 0; i < this.latlngs.length; i++) {
			this._verticesHandlers.push(
				new L.Edit.PolyVerticesEdit(
					this._poly,
					this.latlngs[i],
					this._poly.options.poly
				)
			);
		}
		console.log("vertice handlers: ", this._verticesHandlers.length);
	},

	_updateLatLngs: function (e) {
		this.latlngs = [e.layer._latlngs];
		if (e.layer._holes) {
			this.latlngs = this.latlngs.concat(e.layer._holes);
		}
	},
});

/**
 * @class L.Edit.PolyVerticesEdit
 * @aka Edit.PolyVerticesEdit
 */
L.Edit.PolyVerticesEdit = L.Handler.extend({
	options: {
		icon: new L.DivIcon({
			iconSize: new L.Point(8, 8),
			className: "leaflet-div-icon leaflet-editing-icon",
		}),
		touchIcon: new L.DivIcon({
			iconSize: new L.Point(20, 20),
			className: "leaflet-div-icon leaflet-editing-icon leaflet-touch-icon",
		}),
		drawError: {
			color: "#b00b00",
			timeout: 1000,
		},
	},

	// @method intialize(): void
	initialize: function (poly, latlngs, options) {
		// if touch, switch to touch icon
		if (L.Browser.touch) {
			this.options.icon = this.options.touchIcon;
		}
		this._poly = poly;
		// console.log('this poly: ', poly)
		// console.log('poly holes: ', poly._holes)

		if (options && options.drawError) {
			options.drawError = L.Util.extend(
				{},
				this.options.drawError,
				options.drawError
			);
		}

		this._latlngs = latlngs;

		L.setOptions(this, options);
	},

	// Compatibility method to normalize Poly* objects
	// between 0.7.x and 1.0+
	_defaultShape: function () {
		if (!L.Polyline._flat) {
			return this._latlngs;
		}
		return L.Polyline._flat(this._latlngs) ? this._latlngs : this._latlngs[0];
	},

	// @method addHooks(): void
	// Add listener hooks to this handler.
	addHooks: function () {
		var poly = this._poly;
		var path = poly._path;

		if (!(poly instanceof L.Polygon)) {
			poly.options.fill = false;
			if (poly.options.editing) {
				poly.options.editing.fill = false;
			}
		}

		if (path) {
			if (poly.options.editing && poly.options.editing.className) {
				if (poly.options.original.className) {
					poly.options.original.className
						.split(" ")
						.forEach(function (className) {
							L.DomUtil.removeClass(path, className);
						});
				}
				poly.options.editing.className.split(" ").forEach(function (className) {
					L.DomUtil.addClass(path, className);
				});
			}
		}

		poly.setStyle(poly.options.editing);

		if (this._poly._map) {
			this._map = this._poly._map; // Set map

			if (!this._markerGroup) {
				this._initMarkers();
			}
			this._poly._map.addLayer(this._markerGroup);
		}
	},

	// @method removeHooks(): void
	// Remove listener hooks from this handler.
	removeHooks: function () {
		var poly = this._poly;
		var path = poly._path;

		if (path) {
			if (poly.options.editing && poly.options.editing.className) {
				poly.options.editing.className.split(" ").forEach(function (className) {
					L.DomUtil.removeClass(path, className);
				});
				if (poly.options.original.className) {
					poly.options.original.className
						.split(" ")
						.forEach(function (className) {
							L.DomUtil.addClass(path, className);
						});
				}
			}
		}

		poly.setStyle(poly.options.original);

		if (poly._map) {
			poly._map.removeLayer(this._markerGroup);
			delete this._markerGroup;
			delete this._markers;
		}
	},

	// @method updateMarkers(): void
	// Clear markers and update their location
	updateMarkers: function () {
		this._markerGroup.clearLayers();
		this._initMarkers();
	},

	_initMarkers: function () {
		if (!this._markerGroup) {
			this._markerGroup = new L.LayerGroup();
		}
		this._markers = [];
		this._markerArray = [];
		var latlngs = this._defaultShape(),
			// i,
			// j,
			len,
			marker;

		var markerLeft, markerRight;
		// current polygon can have nested polygons so we take account of this
		currentPolygonLatLngArray = this._latlngs;

		console.log("current polygon array: ", currentPolygonLatLngArray);
		// console.log('current polygon alt: ', this._latlngs.alt)
		// console.log('default shape alt: ', this._defaultShape())

		//handle case where polygons have holes and no holes
		var self = this; // Store reference to 'this'
		var markerIndexOffset = 0;
		// console.log("poly has holes");
		for (i = 0; i < currentPolygonLatLngArray.length; i++) {
			var subPolygonGroups = [];
			for (j = 0; j < currentPolygonLatLngArray[i].length; j++) {
				marker = self._createMarker(
					currentPolygonLatLngArray[i][j],
					j + markerIndexOffset
				);
				marker.on("click", self._onMarkerClick, self);
				marker.on("contextmenu", self._onContextMenu, self);
				self._markers.push(marker);
				console.log("marker indices: ", j + markerIndexOffset);
				subPolygonGroups.push(marker);
			}
			markerIndexOffset += currentPolygonLatLngArray[i].length;
			this._markerArray.push(subPolygonGroups);
		}

		// create middle markers
		// TODO: dont use markerarray to generate markers, use this._latlngs instead
		this._markerArray.forEach(function (polyMarkers) {
			for (i = 0, j = polyMarkers.length - 1; i < polyMarkers.length; j = i++) {
				markerRight = polyMarkers[i];
				markerLeft = polyMarkers[j];
				console.log(
					"marker right: ",
					polyMarkers[i]._index,
					"marker left: ",
					polyMarkers[j]._index
				);
				self._createMiddleMarker(markerLeft, markerRight);
				self._updatePrevNext(markerLeft, markerRight);
			}
		});
	},

	_createMarker: function (latlng, index) {
		/**
		 * Creates a new marker at the specified location and adds it to the marker group.
		 *
		 * @param {L.LatLng} latlng - The location of the marker.
		 * @param {number} index - The index of the marker.
		 * @return {L.Marker} The created marker.
		 */
		// Extending L.Marker in TouchEvents.js to include touch.
		var marker = new L.Marker.Touch(latlng, {
			draggable: true,
			icon: this.options.icon,
		});

		marker._origLatLng = latlng;
		marker._index = index;

		marker
			.on("dragstart", this._onMarkerDragStart, this)
			.on("drag", this._onMarkerDrag, this)
			.on("dragend", this._fireEdit, this)
			.on("touchmove", this._onTouchMove, this)
			.on("touchend", this._fireEdit, this)
			.on("MSPointerMove", this._onTouchMove, this)
			.on("MSPointerUp", this._fireEdit, this);

		this._markerGroup.addLayer(marker);

		return marker;
	},

	_onMarkerDragStart: function () {
		this._poly.fire("editstart");
	},

	// updated spliceLatLngs to handle mpolygon with hole
	_spliceLatLngs: function () {
		var latlngs = [];
		console.log("spliceLatLngs args: ", arguments);
		// console.log('inner poly latlngs: ', this._latlngs[1])
		// create index range
		var indexRangeCummulative = [];
		var indexCummulative = 0;

		for (i = 0; i < this._latlngs.length; i++) {
			indexRangeCummulative.push(this._latlngs[i].length + indexCummulative);
			indexCummulative += this._latlngs[i].length;
		}
		console.log(indexRangeCummulative);

		if (arguments[0] < this._latlngs[0].length) {
			latlngs = this._latlngs[0];
		} else {
			for (i = 1; i < indexRangeCummulative.length; i++) {
				if (
					arguments[0] >= indexRangeCummulative[i - 1] &&
					arguments[0] < indexRangeCummulative[i]
				) {
					latlngs = this._latlngs[i];
					arguments[0] -= indexRangeCummulative[i - 1];
				}
			}
		}

		var removed = [].splice.apply(latlngs, arguments);

		// insert point marker into latlngs
		convertedlatlngs = this._poly._convertLatLngs(this._latlngs, true);

		this._poly.redraw();
		console.log("splice remove: ", removed);
		return removed;
	},

	_removeMarker: function (marker) {
		var i = marker._index;

		this._markerGroup.removeLayer(marker);
		this._markers.splice(i, 1);
		this._spliceLatLngs(i, 1);
		this._updateIndexes(i, -1);

		marker
			.off("dragstart", this._onMarkerDragStart, this)
			.off("drag", this._onMarkerDrag, this)
			.off("dragend", this._fireEdit, this)
			.off("touchmove", this._onMarkerDrag, this)
			.off("touchend", this._fireEdit, this)
			.off("click", this._onMarkerClick, this)
			.off("MSPointerMove", this._onTouchMove, this)
			.off("MSPointerUp", this._fireEdit, this);
	},

	_fireEdit: function () {
		this._poly.edited = true;
		this._poly.fire("edit");
		this._poly._map.fire(L.Draw.Event.EDITVERTEX, {
			layers: this._markerGroup,
			poly: this._poly,
		});
	},

	_onMarkerDrag: function (e) {
		var marker = e.target;
		var poly = this._poly;

		var oldOrigLatLng = L.LatLngUtil.cloneLatLng(marker._origLatLng);
		L.extend(marker._origLatLng, marker._latlng);
		if (poly.options.poly) {
			var tooltip = poly._map._editTooltip; // Access the tooltip

			// If we don't allow intersections and the polygon intersects
			if (!poly.options.poly.allowIntersection && poly.intersects()) {
				L.extend(marker._origLatLng, oldOrigLatLng);
				marker.setLatLng(oldOrigLatLng);
				var originalColor = poly.options.color;
				poly.setStyle({ color: this.options.drawError.color });
				if (tooltip) {
					tooltip.updateContent({
						text: L.drawLocal.draw.handlers.polyline.error,
					});
				}

				// Reset everything back to normal after a second
				setTimeout(function () {
					poly.setStyle({ color: originalColor });
					if (tooltip) {
						tooltip.updateContent({
							text: L.drawLocal.edit.handlers.edit.tooltip.text,
							subtext: L.drawLocal.edit.handlers.edit.tooltip.subtext,
						});
					}
				}, 1000);
			}
		}

		if (marker._middleLeft) {
			marker._middleLeft.setLatLng(this._getMiddleLatLng(marker._prev, marker));
		}
		if (marker._middleRight) {
			marker._middleRight.setLatLng(
				this._getMiddleLatLng(marker, marker._next)
			);
		}

		//refresh the bounds when draging
		this._poly._bounds._southWest = L.latLng(Infinity, Infinity);
		this._poly._bounds._northEast = L.latLng(-Infinity, -Infinity);
		var latlngs = this._poly.getLatLngs();
		this._poly._convertLatLngs(latlngs, true);
		this._poly.redraw();
		this._poly.fire("editdrag");
	},

	_onMarkerClick: function (e) {
		var minPoints = L.Polygon && this._poly instanceof L.Polygon ? 4 : 3,
			marker = e.target;

		// If removing this point would create an invalid polyline/polygon don't remove
		if (this._defaultShape().length < minPoints) {
			return;
		}

		// remove the marker
		this._removeMarker(marker);

		// update prev/next links of adjacent markers
		this._updatePrevNext(marker._prev, marker._next);

		// remove ghost markers near the removed marker
		if (marker._middleLeft) {
			this._markerGroup.removeLayer(marker._middleLeft);
		}
		if (marker._middleRight) {
			this._markerGroup.removeLayer(marker._middleRight);
		}

		// create a ghost marker in place of the removed one
		if (marker._prev && marker._next) {
			this._createMiddleMarker(marker._prev, marker._next);
		} else if (!marker._prev) {
			marker._next._middleLeft = null;
		} else if (!marker._next) {
			marker._prev._middleRight = null;
		}

		this._fireEdit();
	},

	_onContextMenu: function (e) {
		var marker = e.target;
		var poly = this._poly;
		this._poly._map.fire(L.Draw.Event.MARKERCONTEXT, {
			marker: marker,
			layers: this._markerGroup,
			poly: this._poly,
		});
		L.DomEvent.stopPropagation;
	},

	_onTouchMove: function (e) {
		var layerPoint = this._map.mouseEventToLayerPoint(
				e.originalEvent.touches[0]
			),
			latlng = this._map.layerPointToLatLng(layerPoint),
			marker = e.target;

		L.extend(marker._origLatLng, latlng);

		if (marker._middleLeft) {
			marker._middleLeft.setLatLng(this._getMiddleLatLng(marker._prev, marker));
		}
		if (marker._middleRight) {
			marker._middleRight.setLatLng(
				this._getMiddleLatLng(marker, marker._next)
			);
		}

		this._poly.redraw();
		this.updateMarkers();
	},

	_updateIndexes: function (index, delta) {
		this._markerGroup.eachLayer(function (marker) {
			if (marker._index > index) {
				marker._index += delta;
			}
		});
	},

	_createMiddleMarker: function (marker1, marker2) {
		var latlng = this._getMiddleLatLng(marker1, marker2),
			marker = this._createMarker(latlng),
			onClick,
			onDragStart,
			onDragEnd;

		marker.setOpacity(0.6);

		marker1._middleRight = marker2._middleLeft = marker;

		// update the dragstart function to hangle multipolygon
		onDragStart = function () {
			marker.off("touchmove", onDragStart, this);
			//check marker2 and marker1 index first
			var i = marker2._index;
			console.log("latlng when dragged: ", this._latlngs);
			marker._index = i;
			console.log("drag marker index: ", i);
			marker.off("click", onClick, this).on("click", this._onMarkerClick, this);

			latlng.lat = marker.getLatLng().lat;
			latlng.lng = marker.getLatLng().lng;
			this._spliceLatLngs(i, 0, latlng);
			this._markers.splice(i, 0, marker);

			// markerIndices = this._markers;
			// markerIndices.forEach(function (marker) {
			// 	console.log("marker index: ", marker._index);
			// });
			// console.log("maker indices: ", markerIndices);
			marker.setOpacity(1);

			this._updateIndexes(i, 1);
			marker2._index++;
			this._updatePrevNext(marker1, marker);
			this._updatePrevNext(marker, marker2);

			this._poly.fire("editstart");
		};

		onDragEnd = function () {
			marker.off("dragstart", onDragStart, this);
			marker.off("dragend", onDragEnd, this);
			marker.off("touchmove", onDragStart, this);

			this._createMiddleMarker(marker1, marker);
			this._createMiddleMarker(marker, marker2);
		};

		onClick = function () {
			onDragStart.call(this);
			onDragEnd.call(this);
			this._fireEdit();
		};

		marker
			.on("click", onClick, this)
			.on("dragstart", onDragStart, this)
			.on("dragend", onDragEnd, this)
			.on("touchmove", onDragStart, this);

		this._markerGroup.addLayer(marker);
	},

	_updatePrevNext: function (marker1, marker2) {
		if (marker1) {
			marker1._next = marker2;
		}
		if (marker2) {
			marker2._prev = marker1;
		}
	},

	_getMiddleLatLng: function (marker1, marker2) {
		var map = this._poly._map,
			p1 = map.project(marker1.getLatLng()),
			p2 = map.project(marker2.getLatLng());

		return map.unproject(p1._add(p2)._divideBy(2));
	},
});

L.Polyline.addInitHook(function () {
	// Check to see if handler has already been initialized. This is to support versions of Leaflet that still have L.Handler.PolyEdit
	if (this.editing) {
		return;
	}

	if (L.Edit.Poly) {
		this.editing = new L.Edit.Poly(this);

		if (this.options.editable) {
			this.editing.enable();
		}
	}

	this.on("add", function () {
		if (this.editing && this.editing.enabled()) {
			this.editing.addHooks();
		}
	});

	this.on("remove", function () {
		if (this.editing && this.editing.enabled()) {
			this.editing.removeHooks();
		}
	});
});
