INSERT OR IGNORE INTO vehicles (id, title, brand, model, year, price_ars, mileage_km, location, image_url, description, status) VALUES
(1, 'Toyota Corolla SEG 2.0', 'Toyota', 'Corolla SEG', 2022, 28500000, 42000, 'Rosario, Santa Fe', 'https://images.unsplash.com/photo-1623869675781-80aa31012a5a?auto=format&fit=crop&w=1200&q=80', 'Sedan automático, único dueño y service oficial.', 'available'),
(2, 'Volkswagen Taos Comfortline', 'Volkswagen', 'Taos Comfortline', 2023, 33900000, 27000, 'Funes, Santa Fe', 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=80', 'SUV turbo con garantía y documentación al día.', 'available'),
(3, 'Ford Ranger XLT 4x4', 'Ford', 'Ranger XLT', 2021, 31500000, 68000, 'Rosario, Santa Fe', 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=1200&q=80', 'Pickup 4x4, caja cubierta y control crucero.', 'reserved'),
(4, 'Fiat Cronos Precision', 'Fiat', 'Cronos Precision', 2022, 19800000, 51000, 'Villa Gobernador Gálvez', 'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1200&q=80', 'Muy buen estado general, listo para transferir.', 'available');

INSERT OR IGNORE INTO price_references (vehicle_id, source, source_label, price_ars, url) VALUES
(1, 'mercadolibre', 'Mercado Libre', 29200000, 'https://listado.mercadolibre.com.ar/'),
(1, 'rosario_garage', 'Rosario Garage', 29900000, 'https://www.rosariogarage.com/'),
(1, 'official', 'Referencia oficial', 27800000, NULL),
(2, 'mercadolibre', 'Mercado Libre', 34600000, 'https://listado.mercadolibre.com.ar/'),
(2, 'rosario_garage', 'Rosario Garage', 35200000, 'https://www.rosariogarage.com/'),
(2, 'official', 'Referencia oficial', 33100000, NULL),
(3, 'mercadolibre', 'Mercado Libre', 32200000, 'https://listado.mercadolibre.com.ar/'),
(3, 'rosario_garage', 'Rosario Garage', 31800000, 'https://www.rosariogarage.com/'),
(3, 'official', 'Referencia oficial', 30700000, NULL),
(4, 'mercadolibre', 'Mercado Libre', 20300000, 'https://listado.mercadolibre.com.ar/'),
(4, 'rosario_garage', 'Rosario Garage', 21000000, 'https://www.rosariogarage.com/'),
(4, 'official', 'Referencia oficial', 19400000, NULL);
